import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  EVENT,
  hasPermission,
  PartnerReportCadence,
  PartnerReportInviteStatus,
  PartnerReportStatus,
  type Paginated,
  type RoleName,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationsService, type NotifyRecipient } from '../notifications/notifications.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { PartnerReportEntity } from './infrastructure/persistence/partner-report.entity';
import { PartnerReportInviteEntity } from './infrastructure/persistence/partner-report-invite.entity';
import { PartnerReportEngagementUpdateEntity } from './infrastructure/persistence/partner-report-engagement-update.entity';
import { PartnerReportDecisionEntity } from './infrastructure/persistence/partner-report-decision.entity';
import { PartnerReportBillingItemEntity } from './infrastructure/persistence/partner-report-billing-item.entity';
import { PartnerReportReporterEntity } from './infrastructure/persistence/partner-report-reporter.entity';
import type {
  CreateInviteDto,
  MyReportingStatusDto,
  ReportListQueryDto,
  RequestReportDto,
  ReviewReportDto,
  SaveReportDto,
  UpdateReporterDto,
} from './presentation/dto/partner-report.dto';
import {
  InviteResponseDto,
  InviteResultDto,
  PartnerReportResponseDto,
  ReporterDto,
} from './presentation/dto/partner-report.dto';

const GUEST_ROLE = 'Guest';
const STAFF_ROLE = 'Staff';
const CLIENT_ROLE = 'Client';
/** Roles enabled for reporting via roster (no base partner-report permission). */
const ROSTER_REPORT_ROLES = new Set([STAFF_ROLE, CLIENT_ROLE]);
const REPORT_POPULATE = ['submittedBy', 'engagementUpdates', 'decisions', 'billingItems'] as const;

@Injectable()
export class PartnerReportsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
  ) {}

  private canSeeAll(user: AuthenticatedUser): boolean {
    return hasPermission(user.role, 'partner-report:view-all', user.partnerDesignation);
  }

  /** Principal Partner(s) to notify on submission. */
  private async chairmanRecipients(): Promise<NotifyRecipient[]> {
    const pps = await this.em.find(UserEntity, { partnerDesignation: 'PrincipalPartner', isActive: true });
    return pps.map((u) => ({ userId: u.id, email: u.email ?? null }));
  }

  private toDto(r: PartnerReportEntity): PartnerReportResponseDto {
    return {
      id: r.id,
      submittedById: r.submittedBy.id,
      submittedByName: r.submittedBy.fullName ?? null,
      reportingOfficerName: r.reportingOfficerName,
      officerTitle: r.officerTitle ?? null,
      department: r.department,
      periodType: r.periodType,
      periodLabel: r.periodLabel ?? null,
      executiveSummary: r.executiveSummary ?? null,
      currency: r.currency ?? null,
      feeRevenue: r.feeRevenue ?? null,
      billingItems: r.billingItems
        .getItems()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((b) => ({
          description: b.description,
          amount: b.amount,
          amountReceived: b.amountReceived ?? '0',
        })),
      collectionsReceived: r.collectionsReceived ?? null,
      outstanding: r.outstanding ?? null,
      remark: r.remark ?? null,
      peopleCapacity: r.peopleCapacity ?? null,
      outlook: r.outlook ?? null,
      status: r.status,
      submittedAt: r.submittedAt ?? null,
      reviewNotes: r.reviewNotes ?? null,
      reviewedAt: r.reviewedAt ?? null,
      isGuest: r.invite != null,
      engagementUpdates: r.engagementUpdates.getItems().map((u) => ({
        clientEngagement: u.clientEngagement,
        update: u.update,
        status: u.status,
      })),
      decisions: r.decisions.getItems().map((d) => ({ decision: d.decision, priority: d.priority })),
      createdAt: r.createdAt,
    };
  }

  private async loadOwnedOrAll(id: string, user: AuthenticatedUser): Promise<PartnerReportEntity> {
    const where = this.canSeeAll(user) ? { id } : { id, submittedBy: user.userId };
    const report = await this.em.findOne(PartnerReportEntity, where as FilterQuery<PartnerReportEntity>, {
      populate: [...REPORT_POPULATE, 'invite'],
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  // ---- Roster / invite (Principal Partner) --------------------------------

  private periodStart(cadence: PartnerReportCadence, now = new Date()): Date | null {
    if (cadence === PartnerReportCadence.None) return null;
    const d = new Date(now);
    if (cadence === PartnerReportCadence.Weekly) {
      const day = d.getDay(); // 0 Sun
      const diff = day === 0 ? 6 : day - 1; // Monday start
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - diff);
      return d;
    }
    if (cadence === PartnerReportCadence.Monthly) {
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    // Quarterly
    const q = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), q, 1);
  }

  private expectationFor(
    cadence: PartnerReportCadence,
    requestedAt: Date | null | undefined,
    lastSubmittedAt: Date | null | undefined,
  ): 'ok' | 'requested' | 'due' {
    if (requestedAt) return 'requested';
    const start = this.periodStart(cadence);
    if (!start) return 'ok';
    if (!lastSubmittedAt || lastSubmittedAt < start) return 'due';
    return 'ok';
  }

  private async lastSubmittedAt(userId: string): Promise<Date | null> {
    const row = await this.em.findOne(
      PartnerReportEntity,
      {
        submittedBy: userId,
        status: { $in: [PartnerReportStatus.Submitted, PartnerReportStatus.Reviewed] },
      } as FilterQuery<PartnerReportEntity>,
      { orderBy: { submittedAt: 'desc' }, fields: ['submittedAt'] as never },
    );
    return row?.submittedAt ?? null;
  }

  private async upsertRoster(
    user: UserEntity,
    ppUserId: string,
    prefs?: {
      cadence?: PartnerReportCadence;
      remindersEnabled?: boolean;
      financialsEnabled?: boolean;
    },
  ): Promise<PartnerReportReporterEntity> {
    let row = await this.em.findOne(PartnerReportReporterEntity, { user: user.id });
    if (!row) {
      row = this.em.create(PartnerReportReporterEntity, {
        user,
        allowedBy: this.em.getReference(UserEntity, ppUserId),
        cadence: prefs?.cadence ?? PartnerReportCadence.Weekly,
        remindersEnabled: prefs?.remindersEnabled ?? true,
        financialsEnabled: prefs?.financialsEnabled ?? true,
      });
      this.em.persist(row);
    } else {
      if (prefs?.cadence != null) row.cadence = prefs.cadence;
      if (prefs?.remindersEnabled != null) row.remindersEnabled = prefs.remindersEnabled;
      if (prefs?.financialsEnabled != null) row.financialsEnabled = prefs.financialsEnabled;
    }
    return row;
  }

  private reporterKind(user: UserEntity): 'partner' | 'guest' | 'staff' | 'client' {
    if (user.partnerDesignation === 'Partner') return 'partner';
    if (user.role?.roleName === GUEST_ROLE) return 'guest';
    if (user.role?.roleName === CLIENT_ROLE) return 'client';
    return 'staff';
  }

  /** Nudge an existing user to submit a report (no new account created). */
  private async remindToSubmit(
    user: UserEntity,
    actorId: string | null,
    body?: string,
  ): Promise<void> {
    await this.notifications.emit({
      recipients: [{ userId: user.id, email: user.email ?? null }],
      type: 'partner-report.reminder',
      title: 'Reminder: the Principal is awaiting your report',
      body: body ?? 'Please submit your report when you have a moment.',
      entityType: 'partner-report',
      link: '/reports',
      excludeUserId: actorId ?? undefined,
    });
  }

  async createInvite(dto: CreateInviteDto, pp: AuthenticatedUser): Promise<InviteResultDto> {
    const email = dto.email.toLowerCase();
    const prefs = {
      cadence: dto.cadence ?? PartnerReportCadence.Weekly,
      remindersEnabled: dto.remindersEnabled ?? true,
      financialsEnabled: dto.financialsEnabled ?? true,
    };
    const existing = await this.em.findOne(UserEntity, { email }, { populate: ['role'] });
    if (existing) {
      return this.inviteExistingUser(existing, pp, prefs);
    }
    const guestRole = await this.em.findOne(RoleEntity, { roleName: GUEST_ROLE });
    if (!guestRole) throw new NotFoundException('Guest role is not seeded');

    const parts = dto.fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? dto.fullName;
    const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? dto.fullName;
    const tempPassword = randomBytes(9).toString('base64url');

    const guest = this.em.create(UserEntity, {
      role: guestRole,
      firstName,
      middleName: null,
      surname,
      fullName: dto.fullName.trim(),
      email,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      isActive: true,
    });
    const invite = this.em.create(PartnerReportInviteEntity, {
      invitedBy: this.em.getReference(UserEntity, pp.userId),
      guestUser: guest,
      email,
      status: PartnerReportInviteStatus.Invited,
    });
    await this.upsertRoster(guest, pp.userId, prefs);
    this.outbox.enqueue(EVENT.UserCreated, { userId: guest.id, email, tempPassword });
    this.outbox.enqueue(EVENT.PartnerReportInvited, { inviteId: invite.id, email });
    await this.em.persistAndFlush(invite);
    return { outcome: 'invited', email, userId: guest.id, inviteId: invite.id };
  }

  private async inviteExistingUser(
    existing: UserEntity,
    pp: AuthenticatedUser,
    prefs: { cadence: PartnerReportCadence; remindersEnabled: boolean; financialsEnabled: boolean },
  ): Promise<InviteResultDto> {
    const email = existing.email.toLowerCase();
    const roleName = existing.role.roleName as RoleName;

    if (ROSTER_REPORT_ROLES.has(roleName)) {
      await this.upsertRoster(existing, pp.userId, prefs);
      await this.remindToSubmit(existing, pp.userId);
      await this.em.flush();
      return { outcome: 'allowed', email, userId: existing.id, inviteId: null };
    }

    if (hasPermission(roleName, 'partner-report:submit', existing.partnerDesignation ?? null)) {
      await this.upsertRoster(existing, pp.userId, prefs);
      await this.remindToSubmit(existing, pp.userId);
      await this.em.flush();
      return { outcome: 'reminded', email, userId: existing.id, inviteId: null };
    }

    throw new BadRequestException(
      'This account cannot submit reports. Invite a Staff member, Client, Partner, or a new external email.',
    );
  }

  private inviteDto(i: PartnerReportInviteEntity): InviteResponseDto {
    return { id: i.id, email: i.email, guestUserId: i.guestUser.id, status: i.status, createdAt: i.createdAt };
  }

  async listInvites(pp: AuthenticatedUser, query: ReportListQueryDto): Promise<Paginated<InviteResponseDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      PartnerReportInviteEntity,
      { invitedBy: pp.userId } as FilterQuery<PartnerReportInviteEntity>,
      { populate: ['guestUser'], orderBy: { createdAt: 'desc' }, limit, offset },
    );
    return paginated(rows.map((i) => this.inviteDto(i)), total, page, pageSize);
  }

  private async toReporterDto(row: PartnerReportReporterEntity): Promise<ReporterDto> {
    const user = row.user;
    await this.em.populate(user, ['role']);
    const lastSubmittedAt = await this.lastSubmittedAt(user.id);
    const invite = await this.em.findOne(
      PartnerReportInviteEntity,
      { guestUser: user.id, status: { $ne: PartnerReportInviteStatus.Revoked } },
      { orderBy: { createdAt: 'desc' } },
    );
    return {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      kind: this.reporterKind(user),
      inviteStatus: invite?.status ?? null,
      allowedAt: row.createdAt,
      cadence: row.cadence,
      remindersEnabled: row.remindersEnabled,
      financialsEnabled: row.financialsEnabled,
      reportRequestedAt: row.reportRequestedAt ?? null,
      requestNote: row.requestNote ?? null,
      lastSubmittedAt,
      expectation: this.expectationFor(row.cadence, row.reportRequestedAt, lastSubmittedAt),
    };
  }

  /** Unified roster (Staff / Partners / Guests with prefs). */
  async listReporters(): Promise<ReporterDto[]> {
    // Ensure designated Partners appear even if never explicitly invited.
    const partners = await this.em.find(
      UserEntity,
      { partnerDesignation: 'Partner', isActive: true },
      { populate: ['role'] },
    );
    for (const p of partners) {
      const existing = await this.em.findOne(PartnerReportReporterEntity, { user: p.id });
      if (!existing) {
        // System-owned roster row; allowedBy = self until a PP edits prefs.
        this.em.create(PartnerReportReporterEntity, {
          user: p,
          allowedBy: p,
          cadence: PartnerReportCadence.Weekly,
          remindersEnabled: true,
        });
      }
    }
    await this.em.flush();

    const rows = await this.em.find(
      PartnerReportReporterEntity,
      {},
      { populate: ['user', 'user.role'], orderBy: { createdAt: 'desc' } },
    );
    const data: ReporterDto[] = [];
    for (const row of rows) {
      if (!row.user.isActive) continue;
      data.push(await this.toReporterDto(row));
    }
    return data.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async updateReporter(userId: string, dto: UpdateReporterDto): Promise<ReporterDto> {
    const row = await this.em.findOne(
      PartnerReportReporterEntity,
      { user: userId },
      { populate: ['user', 'user.role'] },
    );
    if (!row) throw new NotFoundException('Reporter not found on the roster');
    if (dto.cadence != null) row.cadence = dto.cadence;
    if (dto.remindersEnabled != null) row.remindersEnabled = dto.remindersEnabled;
    if (dto.financialsEnabled != null) row.financialsEnabled = dto.financialsEnabled;
    await this.em.flush();
    return this.toReporterDto(row);
  }

  async requestReport(
    userId: string,
    dto: RequestReportDto,
    pp: AuthenticatedUser,
  ): Promise<ReporterDto> {
    const row = await this.em.findOne(
      PartnerReportReporterEntity,
      { user: userId },
      { populate: ['user', 'user.role'] },
    );
    if (!row) throw new NotFoundException('Reporter not found on the roster');
    row.reportRequestedAt = new Date();
    row.requestNote = dto.note?.trim() || null;
    row.lastRemindedAt = new Date();
    await this.notifications.emit({
      recipients: [{ userId: row.user.id, email: row.user.email ?? null }],
      type: 'partner-report.reminder',
      title: 'Report requested by the Principal',
      body: dto.note?.trim() || 'Please submit a report when you can. You may also submit anytime outside your usual cadence.',
      entityType: 'partner-report',
      link: '/reports/new',
      excludeUserId: pp.userId,
    });
    await this.em.flush();
    return this.toReporterDto(row);
  }

  async remindReporter(userId: string, pp: AuthenticatedUser): Promise<ReporterDto> {
    const row = await this.em.findOne(
      PartnerReportReporterEntity,
      { user: userId },
      { populate: ['user', 'user.role'] },
    );
    if (!row) throw new NotFoundException('Reporter not found on the roster');
    row.lastRemindedAt = new Date();
    await this.remindToSubmit(row.user, pp.userId);
    await this.em.flush();
    return this.toReporterDto(row);
  }

  /**
   * Remove from roster (Staff prefs / Guest invite revoke).
   * Partners keep designation; only roster prefs row is removed.
   */
  async removeReporter(userId: string): Promise<void> {
    const row = await this.em.findOne(PartnerReportReporterEntity, { user: userId });
    if (row) this.em.remove(row);

    const invite = await this.em.findOne(
      PartnerReportInviteEntity,
      { guestUser: userId, status: PartnerReportInviteStatus.Invited },
    );
    if (invite) invite.status = PartnerReportInviteStatus.Revoked;

    if (!row && !invite) {
      throw new NotFoundException('Reporter not found on the roster');
    }
    await this.em.flush();
  }

  async myReportingStatus(user: AuthenticatedUser): Promise<MyReportingStatusDto> {
    const canSubmit =
      hasPermission(user.role, 'partner-report:submit', user.partnerDesignation) ||
      (ROSTER_REPORT_ROLES.has(user.role) &&
        (await this.em.findOne(PartnerReportReporterEntity, { user: user.userId })) != null);

    const row = await this.em.findOne(PartnerReportReporterEntity, { user: user.userId });
    const lastSubmittedAt = await this.lastSubmittedAt(user.userId);
    const cadence = row?.cadence ?? null;
    const requestedAt = row?.reportRequestedAt ?? null;
    return {
      canSubmit,
      cadence,
      remindersEnabled: row?.remindersEnabled ?? false,
      financialsEnabled: row?.financialsEnabled ?? true,
      reportRequestedAt: requestedAt,
      requestNote: row?.requestNote ?? null,
      lastSubmittedAt,
      expectation: cadence
        ? this.expectationFor(cadence, requestedAt, lastSubmittedAt)
        : requestedAt
          ? 'requested'
          : 'ok',
    };
  }

  /** Polished PDF for a single report (Principal or owner). */
  async exportReportPdf(id: string, user: AuthenticatedUser): Promise<Buffer> {
    const report = await this.loadOwnedOrAll(id, user);
    const { buildPartnerReportPdf } = await import('./partner-report-pdf');
    return buildPartnerReportPdf(report);
  }

  /** CSV export for one report — kept for programmatic use; UI uses PDF. */
  async exportReportCsv(id: string, user: AuthenticatedUser): Promise<string> {
    const report = await this.loadOwnedOrAll(id, user);
    return this.reportToCsv([report]);
  }

  /** CSV export for the current list filter (Principal sees all in filter). */
  async exportListCsv(query: ReportListQueryDto, user: AuthenticatedUser): Promise<string> {
    const where: Record<string, unknown> = this.canSeeAll(user) ? {} : { submittedBy: user.userId };
    if (query.status) where.status = query.status;
    if (query.periodType) where.periodType = query.periodType;
    const rows = await this.em.find(PartnerReportEntity, where as FilterQuery<PartnerReportEntity>, {
      populate: [...REPORT_POPULATE, 'invite'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit: 500,
    });
    return this.reportToCsv(rows);
  }

  private csvEscape(value: unknown): string {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  private reportToCsv(rows: PartnerReportEntity[]): string {
    const headers = [
      'id',
      'officer',
      'department',
      'periodType',
      'periodLabel',
      'status',
      'submittedAt',
      'reviewedAt',
      'reviewNotes',
      'executiveSummary',
      'currency',
      'feeRevenue',
      'billingItems',
      'collectionsReceived',
      'outstanding',
      'remark',
      'peopleCapacity',
      'outlook',
      'engagementUpdates',
      'decisions',
      'isGuest',
      'submittedBy',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const updates = r.engagementUpdates
        .getItems()
        .map((u) => `${u.clientEngagement}: ${u.update} [${u.status}]`)
        .join(' | ');
      const decisions = r.decisions
        .getItems()
        .map((d) => `${d.decision} [${d.priority}]`)
        .join(' | ');
      const billings = r.billingItems
        .getItems()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((b) => `${b.description}: ${b.amount}/${b.amountReceived ?? '0'}`)
        .join(' | ');
      lines.push(
        [
          r.id,
          r.reportingOfficerName,
          r.department,
          r.periodType,
          r.periodLabel,
          r.status,
          r.submittedAt?.toISOString() ?? '',
          r.reviewedAt?.toISOString() ?? '',
          r.reviewNotes,
          r.executiveSummary,
          r.currency,
          r.feeRevenue,
          billings,
          r.collectionsReceived,
          r.outstanding,
          r.remark,
          r.peopleCapacity,
          r.outlook,
          updates,
          decisions,
          r.invite != null,
          r.submittedBy?.fullName ?? r.submittedBy?.id ?? '',
        ]
          .map((v) => this.csvEscape(v))
          .join(','),
      );
    }
    return lines.join('\n');
  }

  // ---- Report authoring ----------------------------------------------------

  private parseMoney(value: string, label: string): number {
    const n = Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException(`Invalid ${label}: ${value}`);
    }
    return n;
  }

  private sumMoney(values: number[]): string | null {
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0).toFixed(2);
  }

  private hasFinancialPayload(dto: SaveReportDto): boolean {
    const items = (dto.billingItems ?? []).filter(
      (b) =>
        b.description?.trim() ||
        (b.amount != null && String(b.amount).trim() !== '') ||
        (b.amountReceived != null && String(b.amountReceived).trim() !== ''),
    );
    return Boolean(
      dto.currency ||
        items.length ||
        (dto.remark != null && String(dto.remark).trim() !== ''),
    );
  }

  private async assertFinancialsAllowed(userId: string, dto: SaveReportDto): Promise<void> {
    if (!this.hasFinancialPayload(dto)) return;
    const roster = await this.em.findOne(PartnerReportReporterEntity, { user: userId });
    if (roster && roster.financialsEnabled === false) {
      throw new BadRequestException('Financials are not enabled for this reporter');
    }
  }

  private applyRows(report: PartnerReportEntity, dto: SaveReportDto): void {
    const billingItems = (dto.billingItems ?? []).filter(
      (b) => b.description?.trim() && b.amount != null && String(b.amount).trim() !== '',
    );
    const billAmounts: number[] = [];
    const receivedAmounts: number[] = [];
    billingItems.forEach((b, i) => {
      const amount = this.parseMoney(String(b.amount), 'bill amount');
      const receivedRaw =
        b.amountReceived != null && String(b.amountReceived).trim() !== ''
          ? String(b.amountReceived)
          : '0';
      // Allow received > bill for rare edge cases (UI still flags the line in red).
      const amountReceived = this.parseMoney(receivedRaw, 'amount received');
      billAmounts.push(amount);
      receivedAmounts.push(amountReceived);
      this.em.create(PartnerReportBillingItemEntity, {
        report,
        description: b.description.trim(),
        amount: amount.toFixed(2),
        amountReceived: amountReceived.toFixed(2),
        sortOrder: i,
      });
    });
    const fee = this.sumMoney(billAmounts);
    const collections = this.sumMoney(receivedAmounts);
    report.feeRevenue = fee;
    report.collectionsReceived = collections;
    if (fee != null && collections != null) {
      report.outstanding = (Number(fee) - Number(collections)).toFixed(2);
    } else {
      report.outstanding = null;
    }

    (dto.engagementUpdates ?? []).forEach((u, i) => {
      this.em.create(PartnerReportEngagementUpdateEntity, {
        report,
        clientEngagement: u.clientEngagement,
        update: u.update,
        status: u.status,
        sortOrder: i,
      });
    });
    (dto.decisions ?? []).forEach((d, i) => {
      this.em.create(PartnerReportDecisionEntity, {
        report,
        decision: d.decision,
        priority: d.priority,
        sortOrder: i,
      });
    });
  }

  private assignScalars(report: PartnerReportEntity, dto: SaveReportDto): void {
    report.reportingOfficerName = dto.reportingOfficerName;
    report.officerTitle = dto.officerTitle ?? null;
    report.department = dto.department;
    report.periodType = dto.periodType;
    report.periodLabel = dto.periodLabel ?? null;
    report.executiveSummary = dto.executiveSummary ?? null;
    report.currency = dto.currency ?? null;
    report.remark = dto.remark ?? null;
    report.peopleCapacity = dto.peopleCapacity ?? null;
    report.outlook = dto.outlook ?? null;
  }

  /** Create a draft report authored by the caller (partner or invited guest). */
  async create(dto: SaveReportDto, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    await this.assertFinancialsAllowed(user.userId, dto);
    const report = this.em.create(PartnerReportEntity, {
      submittedBy: this.em.getReference(UserEntity, user.userId),
      reportingOfficerName: dto.reportingOfficerName,
      officerTitle: dto.officerTitle ?? null,
      department: dto.department,
      periodType: dto.periodType,
      status: PartnerReportStatus.Draft,
    });
    this.assignScalars(report, dto);
    // Link a guest's report to their invite.
    const invite = await this.em.findOne(PartnerReportInviteEntity, {
      guestUser: user.userId,
      status: PartnerReportInviteStatus.Invited,
    });
    if (invite) report.invite = invite;
    this.applyRows(report, dto);
    await this.em.persistAndFlush(report);
    return this.getOne(report.id, user);
  }

  async update(id: string, dto: SaveReportDto, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    const report = await this.loadOwnedOrAll(id, user);
    if (report.status !== PartnerReportStatus.Draft) {
      throw new BadRequestException('Only a draft report can be edited');
    }
    await this.assertFinancialsAllowed(user.userId, dto);
    this.assignScalars(report, dto);
    // Replace child rows.
    await this.em.nativeDelete(PartnerReportBillingItemEntity, { report: id });
    await this.em.nativeDelete(PartnerReportEngagementUpdateEntity, { report: id });
    await this.em.nativeDelete(PartnerReportDecisionEntity, { report: id });
    this.applyRows(report, dto);
    await this.em.flush();
    return this.getOne(id, user);
  }

  async submit(id: string, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    const report = await this.loadOwnedOrAll(id, user);
    if (report.status !== PartnerReportStatus.Draft) {
      throw new BadRequestException(`Report already ${report.status}`);
    }
    report.status = PartnerReportStatus.Submitted;
    report.submittedAt = new Date();
    if (report.invite) report.invite.status = PartnerReportInviteStatus.Submitted;
    const roster = await this.em.findOne(PartnerReportReporterEntity, { user: user.userId });
    if (roster) {
      roster.reportRequestedAt = null;
      roster.requestNote = null;
    }
    await this.notifications.emit({
      recipients: await this.chairmanRecipients(),
      type: 'partner-report.submitted',
      title: `Report submitted: ${report.reportingOfficerName}`,
      body: report.executiveSummary?.slice(0, 140),
      entityType: 'partner-report',
      entityId: report.id,
      link: `/reports/${report.id}`,
      excludeUserId: user.userId,
    });
    this.outbox.enqueue(EVENT.PartnerReportSubmitted, { reportId: report.id });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async list(query: ReportListQueryDto, user: AuthenticatedUser): Promise<Paginated<PartnerReportResponseDto>> {
    const where: Record<string, unknown> = this.canSeeAll(user) ? {} : { submittedBy: user.userId };
    if (query.status) where.status = query.status;
    if (query.periodType) where.periodType = query.periodType;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      PartnerReportEntity,
      where as FilterQuery<PartnerReportEntity>,
      { populate: [...REPORT_POPULATE, 'invite'], orderBy: { createdAt: 'desc' }, limit, offset },
    );
    return paginated(rows.map((r) => this.toDto(r)), total, page, pageSize);
  }

  async getOne(id: string, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    return this.toDto(await this.loadOwnedOrAll(id, user));
  }

  /**
   * Principal reviews a submitted report, or updates notes on an already-reviewed report.
   */
  async review(id: string, dto: ReviewReportDto, pp: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    const report = await this.em.findOne(PartnerReportEntity, { id }, { populate: [...REPORT_POPULATE, 'invite'] });
    if (!report) throw new NotFoundException('Report not found');
    if (
      report.status !== PartnerReportStatus.Submitted &&
      report.status !== PartnerReportStatus.Reviewed
    ) {
      throw new BadRequestException('Only a submitted or reviewed report can receive Principal notes');
    }

    const firstReview = report.status === PartnerReportStatus.Submitted;
    if (firstReview) {
      report.status = PartnerReportStatus.Reviewed;
      report.reviewedAt = new Date();
    }
    report.reviewedBy = this.em.getReference(UserEntity, pp.userId);
    report.reviewNotes = dto.notes?.trim() || null;

    await this.notifications.emit({
      recipients: [{ userId: report.submittedBy.id, email: report.submittedBy.email ?? null }],
      type: 'partner-report.reviewed',
      title: firstReview
        ? 'The Principal reviewed your report'
        : 'The Principal updated notes on your report',
      body: dto.notes,
      entityType: 'partner-report',
      entityId: report.id,
      link: `/reports/${report.id}`,
      excludeUserId: pp.userId,
    });
    await this.em.flush();
    return this.toDto(report);
  }

  /** Principal dashboard headline counts. */
  async dashboard(): Promise<Record<string, number>> {
    const [total, drafts, submitted, reviewed] = await Promise.all([
      this.em.count(PartnerReportEntity, {}),
      this.em.count(PartnerReportEntity, { status: PartnerReportStatus.Draft }),
      this.em.count(PartnerReportEntity, { status: PartnerReportStatus.Submitted }),
      this.em.count(PartnerReportEntity, { status: PartnerReportStatus.Reviewed }),
    ]);
    const awaitingDecision = await this.em.count(PartnerReportDecisionEntity, {
      report: { status: PartnerReportStatus.Submitted },
    } as FilterQuery<PartnerReportDecisionEntity>);
    return { total, drafts, awaitingReview: submitted, reviewed, awaitingDecision };
  }
}
