import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import {
  LibraryEventAction,
  LibraryItemStatus,
  LibraryReportOutcome,
  LibraryReportReason,
  LibraryReportStatus,
  ROLE_PERMISSIONS,
  type Paginated,
  type RoleName,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { NotificationsService, type NotifyRecipient } from '../notifications/notifications.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { LibraryReportEntity } from './infrastructure/persistence/library-report.entity';
import type { LibraryViewer } from './library-access';
import { LibraryEventsService } from './library-events.service';
import { LibraryService } from './library.service';
import type {
  CreateLibraryReportDto,
  LibraryReportEntryDto,
  LibraryReportGroupDto,
  LibraryReportListQueryDto,
  ResolveLibraryReportDto,
} from './presentation/dto/library-report.dto';

export const REPORT_REASON_LABEL: Record<LibraryReportReason, string> = {
  [LibraryReportReason.ClientConfidential]: 'Client-confidential information',
  [LibraryReportReason.Copyright]: 'Copyright or licence problem',
  [LibraryReportReason.OutdatedOrWrong]: 'Out of date or wrong',
  [LibraryReportReason.Inappropriate]: 'Inappropriate',
  [LibraryReportReason.Other]: 'Something else',
};

const OUTCOME_TEXT: Record<LibraryReportOutcome, string> = {
  [LibraryReportOutcome.Dismiss]: 'reviewed it and left it as it is',
  [LibraryReportOutcome.Restrict]: 'restricted it to specific departments',
  [LibraryReportOutcome.Archive]: 'archived it',
  [LibraryReportOutcome.Delete]: 'deleted it',
};

/** Role names whose base permissions include `library:curate` (curators get report alerts). */
export function curatorRoleNames(): RoleName[] {
  return (Object.entries(ROLE_PERMISSIONS) as [RoleName, string[]][])
    .filter(([, perms]) => perms.includes('library:curate'))
    .map(([role]) => role);
}

/**
 * "Report this item" + the curator review queue (S2, D19/D20).
 * A reported item stays visible until a curator acts; several reports on one item are
 * grouped and resolved together.
 */
@Injectable()
export class LibraryReportsService {
  constructor(
    private readonly em: EntityManager,
    private readonly library: LibraryService,
    private readonly events: LibraryEventsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async curatorRecipients(): Promise<NotifyRecipient[]> {
    const users = await this.em.find(
      UserEntity,
      { isActive: true, role: { roleName: { $in: curatorRoleNames() } } } as FilterQuery<UserEntity>,
      { fields: ['id', 'email'] },
    );
    return users.map((u) => ({ userId: u.id, email: u.email ?? null }));
  }

  private entry(r: LibraryReportEntity): LibraryReportEntryDto {
    return {
      id: r.id,
      reason: r.reason,
      note: r.note ?? null,
      reporter: { id: r.reporter.id, name: r.reporter.fullName },
      status: r.status,
      outcome: r.outcome ?? null,
      resolution: r.resolution ?? null,
      resolvedBy: r.resolvedBy ? { id: r.resolvedBy.id, name: r.resolvedBy.fullName } : null,
      resolvedAt: r.resolvedAt ?? null,
      createdAt: r.createdAt,
    };
  }

  async create(itemId: string, dto: CreateLibraryReportDto, viewer: LibraryViewer): Promise<LibraryReportEntryDto> {
    const item = await this.library.loadVisible(itemId, viewer);
    if (item.status === LibraryItemStatus.Draft) throw new ConflictException('This item has not been published');
    const existing = await this.em.findOne(LibraryReportEntity, {
      item: item.id,
      reporter: viewer.userId,
      status: LibraryReportStatus.Open,
    });
    if (existing) throw new ConflictException('You have already reported this item — a curator will look at it');

    const note = dto.note?.trim() || null;
    const report = this.em.create(LibraryReportEntity, {
      item,
      itemTitle: item.title,
      reporter: this.em.getReference(UserEntity, viewer.userId),
      reason: dto.reason,
      note,
    });
    this.em.persist(report);
    this.events.stage({
      action: LibraryEventAction.Reported,
      viewer,
      itemId: item.id,
      metadata: { reportId: report.id, reason: dto.reason },
    });
    await this.notifications.emit({
      recipients: await this.curatorRecipients(),
      type: 'library.reported',
      title: `Library item reported: ${item.title}`,
      body: `${REPORT_REASON_LABEL[dto.reason]}${note ? ` — ${note.slice(0, 200)}` : ''}`,
      entityType: 'library_item',
      entityId: item.id,
      link: '/library/review',
      excludeUserId: viewer.userId,
    });
    await this.em.flush();
    await this.em.populate(report, ['reporter']);
    return this.entry(report);
  }

  async count(viewer: LibraryViewer): Promise<{ open: number }> {
    if (!viewer.isCurator) return { open: 0 };
    const rows = await this.em.execute<{ n: number }[]>(
      `select count(distinct coalesce(item_id::text, id::text))::int as n from library_reports where status = 'Open'`,
    );
    return { open: Number(rows[0]?.n ?? 0) };
  }

  /** Curators: reports grouped by item, newest activity first. */
  async list(query: LibraryReportListQueryDto, viewer: LibraryViewer): Promise<Paginated<LibraryReportGroupDto>> {
    if (!viewer.isCurator) throw new ForbiddenException('Only library curators can review reports');
    const status = query.status ?? LibraryReportStatus.Open;
    const { page, pageSize, limit, offset } = pageParams(query);
    const groups = await this.em.execute<{ key: string; latest: Date }[]>(
      `select coalesce(item_id::text, 'r:' || id::text) as key, max(coalesce(resolved_at, created_at)) as latest
         from library_reports where status = ?
        group by 1 order by 2 desc limit ? offset ?`,
      [status, limit, offset],
    );
    const totals = await this.em.execute<{ n: number }[]>(
      `select count(distinct coalesce(item_id::text, 'r:' || id::text))::int as n from library_reports where status = ?`,
      [status],
    );
    const itemIds = groups.filter((g) => !g.key.startsWith('r:')).map((g) => g.key);
    const reportIds = groups.filter((g) => g.key.startsWith('r:')).map((g) => g.key.slice(2));
    const reports = await this.em.find(
      LibraryReportEntity,
      {
        status,
        $or: [
          ...(itemIds.length ? [{ item: { $in: itemIds } }] : []),
          ...(reportIds.length ? [{ id: { $in: reportIds } }] : []),
        ],
      } as FilterQuery<LibraryReportEntity>,
      {
        populate: ['reporter', 'resolvedBy', 'item', 'item.uploadedBy', 'item.departments'],
        orderBy: { createdAt: 'desc' },
      },
    );
    const data: LibraryReportGroupDto[] = groups.map((g) => {
      const mine = reports.filter((r) => (g.key.startsWith('r:') ? r.id === g.key.slice(2) : r.item?.id === g.key));
      const item = mine[0]?.item ?? null;
      return {
        itemId: item?.id ?? null,
        itemTitle: item?.title ?? mine[0]?.itemTitle ?? '',
        item: item
          ? {
              status: item.status,
              visibility: item.visibility,
              uploadedBy: { id: item.uploadedBy.id, name: item.uploadedBy.fullName },
              departments: item.departments.getItems().map((d) => ({ id: d.id, name: d.name })),
            }
          : null,
        latestAt: new Date(g.latest),
        reports: mine.map((r) => this.entry(r)),
      };
    });
    return paginated(data, Number(totals[0]?.n ?? 0), page, pageSize);
  }

  /**
   * Resolve a report — and every other open report on the same item (D20). The outcome is
   * applied to the item, each reporter is told what happened, and the action is logged.
   */
  async resolve(
    reportId: string,
    dto: ResolveLibraryReportDto,
    viewer: LibraryViewer,
  ): Promise<{ resolved: number; outcome: LibraryReportOutcome }> {
    if (!viewer.isCurator) throw new ForbiddenException('Only library curators can resolve reports');
    const report = await this.em.findOne(LibraryReportEntity, { id: reportId }, { populate: ['item'] });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== LibraryReportStatus.Open) throw new ConflictException('This report has already been resolved');
    if (!report.item && dto.outcome !== LibraryReportOutcome.Dismiss) {
      throw new ConflictException('The item no longer exists — dismiss the report');
    }
    if (dto.outcome === LibraryReportOutcome.Restrict && !(dto.departmentIds?.length)) {
      throw new BadRequestException('Choose at least one department to restrict the item to');
    }

    const group = report.item
      ? await this.em.find(
          LibraryReportEntity,
          { item: report.item.id, status: LibraryReportStatus.Open },
          { populate: ['reporter'] },
        )
      : [await this.em.findOneOrFail(LibraryReportEntity, { id: report.id }, { populate: ['reporter'] })];

    const item = report.item ? await this.library.loadItem(report.item.id) : null;
    const title = item?.title ?? report.itemTitle;
    const note = dto.note?.trim() || null;
    const now = new Date();
    for (const r of group) {
      r.status = dto.outcome === LibraryReportOutcome.Dismiss ? LibraryReportStatus.Dismissed : LibraryReportStatus.Actioned;
      r.outcome = dto.outcome;
      r.resolution = note;
      r.resolvedBy = this.em.getReference(UserEntity, viewer.userId);
      r.resolvedAt = now;
    }

    if (item && dto.outcome === LibraryReportOutcome.Restrict) {
      await this.library.restrictTo(item, dto.departmentIds!, viewer);
    }
    if (item && (dto.outcome === LibraryReportOutcome.Archive || dto.outcome === LibraryReportOutcome.Delete)) {
      this.library.stageArchive(item, viewer, 'report');
    }
    if (item) {
      this.events.stage({
        action: LibraryEventAction.ReportResolved,
        viewer,
        itemId: item.id,
        metadata: { outcome: dto.outcome, reportIds: group.map((r) => r.id), note },
      });
    }
    await this.notifications.emit({
      recipients: group.map((r) => ({ userId: r.reporter.id, email: r.reporter.email ?? null })),
      type: 'library.report_resolved',
      title: `Your report on “${title}” was resolved`,
      body: `A library curator ${OUTCOME_TEXT[dto.outcome]}.${note ? ` ${note}` : ''}`,
      entityType: 'library_item',
      entityId: item?.id,
      link: item && dto.outcome !== LibraryReportOutcome.Delete ? `/library/${item.id}` : '/library',
      excludeUserId: viewer.userId,
    });
    await this.em.flush();

    if (item && dto.outcome === LibraryReportOutcome.Delete) {
      await this.library.remove(item.id, viewer);
    }
    return { resolved: group.length, outcome: dto.outcome };
  }
}
