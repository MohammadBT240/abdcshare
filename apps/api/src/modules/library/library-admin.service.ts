import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { LibraryEventAction, hasPermission, type RoleName } from '@abdcshare/shared';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { LibraryCollectionEntity } from './infrastructure/persistence/library-collection.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import { libraryScopeSql, type LibraryViewer } from './library-access';
import { LibraryEventsService } from './library-events.service';
import type {
  LibraryAttentionDto,
  LibraryAttentionItemDto,
  LibraryDuplicateDto,
  LibraryDuplicateGroupDto,
  LibraryTransferResultDto,
} from './presentation/dto/library-admin.dto';

const SHA256 = /^[0-9a-f]{64}$/;

/**
 * Curator tooling (S3): duplicate lookup (D27), ownership transfer (D29) and the
 * "Needs attention" view (D30).
 */
@Injectable()
export class LibraryAdminService {
  constructor(
    private readonly em: EntityManager,
    private readonly events: LibraryEventsService,
  ) {}

  private assertCurator(viewer: LibraryViewer): void {
    if (!viewer.isCurator) throw new ForbiddenException('Only library curators can do this');
  }

  // ------------------------------------------------------------------ duplicates (D27)

  /**
   * Published items with the same file hash that the viewer can see. Hidden duplicates are
   * never revealed — not even as a count.
   */
  async duplicatesOf(hash: string, viewer: LibraryViewer, excludeId?: string): Promise<LibraryDuplicateDto[]> {
    const h = hash.trim().toLowerCase();
    if (!SHA256.test(h)) throw new BadRequestException('hash must be a SHA-256 hex digest');
    const scope = libraryScopeSql('i', viewer);
    const rows = await this.em.execute<
      { id: string; title: string; category: string; uploaded_by: string; published_at: Date | null }[]
    >(
      `select i.id, i.title, c.name as category, u.full_name as uploaded_by, i.published_at
         from library_items i
         join library_categories c on c.id = i.category_id
         join users u on u.id = i.uploaded_by_id
        where i.content_hash = ? and i.status = 'Published' and ${scope.sql}
          ${excludeId ? 'and i.id <> ?' : ''}
        order by i.published_at asc nulls last
        limit 5`,
      [h, ...scope.params, ...(excludeId ? [excludeId] : [])],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      uploadedBy: r.uploaded_by,
      publishedAt: r.published_at ? new Date(r.published_at) : null,
    }));
  }

  /** Curators: every hash held by more than one item (any status except Draft). */
  async duplicateGroups(viewer: LibraryViewer): Promise<LibraryDuplicateGroupDto[]> {
    this.assertCurator(viewer);
    const rows = await this.em.execute<
      { content_hash: string; id: string; title: string; status: string; uploaded_by: string; created_at: Date }[]
    >(
      `select i.content_hash, i.id, i.title, i.status, u.full_name as uploaded_by, i.created_at
         from library_items i join users u on u.id = i.uploaded_by_id
        where i.status <> 'Draft' and i.content_hash in (
          select content_hash from library_items
           where content_hash is not null and status <> 'Draft'
           group by content_hash having count(*) > 1)
        order by i.content_hash, i.created_at asc
        limit 500`,
    );
    const groups = new Map<string, LibraryDuplicateGroupDto>();
    for (const r of rows) {
      const g = groups.get(r.content_hash) ?? { hash: r.content_hash, items: [] };
      g.items.push({ id: r.id, title: r.title, status: r.status, uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at) });
      groups.set(r.content_hash, g);
    }
    return [...groups.values()];
  }

  // ------------------------------------------------------------------ transfer (D29)

  /** Active internal users who may own library content (they can contribute). */
  private async assertEligibleOwner(userId: string): Promise<UserEntity> {
    const user = await this.em.findOne(UserEntity, { id: userId }, { populate: ['role'] });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException('Choose an active user');
    if (!hasPermission(user.role.roleName as RoleName, 'library:contribute', user.partnerDesignation)) {
      throw new BadRequestException('That user cannot own library items');
    }
    return user;
  }

  async transferItem(id: string, toUserId: string, viewer: LibraryViewer): Promise<LibraryTransferResultDto> {
    this.assertCurator(viewer);
    const item = await this.em.findOne(LibraryItemEntity, { id }, { populate: ['uploadedBy'] });
    if (!item) throw new NotFoundException('Library item not found');
    const to = await this.assertEligibleOwner(toUserId);
    if (item.uploadedBy.id === to.id) return { items: 0, collections: 0 };
    this.events.stage({
      action: LibraryEventAction.OwnershipTransferred,
      viewer,
      itemId: item.id,
      metadata: { from: { id: item.uploadedBy.id, name: item.uploadedBy.fullName }, to: { id: to.id, name: to.fullName } },
    });
    item.uploadedBy = to;
    await this.em.flush();
    return { items: 1, collections: 0 };
  }

  async transferCollection(id: string, toUserId: string, viewer: LibraryViewer): Promise<LibraryTransferResultDto> {
    this.assertCurator(viewer);
    const c = await this.em.findOne(LibraryCollectionEntity, { id }, { populate: ['owner'] });
    if (!c) throw new NotFoundException('Collection not found');
    const to = await this.assertEligibleOwner(toUserId);
    if (c.owner.id === to.id) return { items: 0, collections: 0 };
    this.events.stage({
      action: LibraryEventAction.OwnershipTransferred,
      viewer,
      collectionId: c.id,
      metadata: { from: { id: c.owner.id, name: c.owner.fullName }, to: { id: to.id, name: to.fullName }, collectionTitle: c.title },
    });
    c.owner = to;
    await this.em.flush();
    return { items: 0, collections: 1 };
  }

  /** "Transfer everything from {user}" — typically after they leave. One transaction. */
  async transferAll(fromUserId: string, toUserId: string, viewer: LibraryViewer): Promise<LibraryTransferResultDto> {
    this.assertCurator(viewer);
    if (fromUserId === toUserId) throw new BadRequestException('Choose a different user');
    const from = await this.em.findOne(UserEntity, { id: fromUserId });
    if (!from) throw new NotFoundException('User not found');
    const to = await this.assertEligibleOwner(toUserId);
    return this.em.transactional(async (em) => {
      const items = await em.find(LibraryItemEntity, { uploadedBy: from.id, status: { $ne: 'Draft' } } as never, {
        fields: ['id', 'uploadedBy'],
      });
      const collections = await em.find(LibraryCollectionEntity, { owner: from.id }, { fields: ['id', 'title', 'owner'] });
      const meta = { from: { id: from.id, name: from.fullName }, to: { id: to.id, name: to.fullName }, bulk: true };
      for (const i of items) {
        this.events.stage({ action: LibraryEventAction.OwnershipTransferred, viewer, itemId: i.id, metadata: meta }, em);
      }
      for (const c of collections) {
        this.events.stage({
          action: LibraryEventAction.OwnershipTransferred,
          viewer,
          collectionId: c.id,
          metadata: { ...meta, collectionTitle: c.title },
        }, em);
      }
      await em.flush();
      // Drafts are abandoned uploads (swept after 24 h) — move them too so nothing dangles.
      await em.nativeUpdate(LibraryItemEntity, { uploadedBy: from.id }, { uploadedBy: to.id });
      await em.nativeUpdate(LibraryCollectionEntity, { owner: from.id }, { owner: to.id });
      return { items: items.length, collections: collections.length };
    });
  }

  // ------------------------------------------------------------------ needs attention (D30)

  private async itemRows(where: string, params: unknown[] = []): Promise<LibraryAttentionItemDto[]> {
    const rows = await this.em.execute<
      {
        id: string;
        title: string;
        status: string;
        uploaded_by_id: string;
        uploaded_by: string;
        detail: string | null;
        updated_at: Date;
        departments: string[] | null;
      }[]
    >(
      `select i.id, i.title, i.status, i.uploaded_by_id, u.full_name as uploaded_by, i.updated_at,
              coalesce(i.preview_error_code, i.scan_error) as detail,
              (select array_agg(d.name order by d.name) from library_item_departments lid
                 join departments d on d.id = lid.department_id where lid.item_id = i.id) as departments
         from library_items i join users u on u.id = i.uploaded_by_id
        where ${where}
        order by i.updated_at desc
        limit 200`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      uploadedBy: { id: r.uploaded_by_id, name: r.uploaded_by },
      detail: r.detail,
      departments: r.departments ?? [],
      updatedAt: new Date(r.updated_at),
    }));
  }

  async attention(viewer: LibraryViewer): Promise<LibraryAttentionDto> {
    this.assertCurator(viewer);
    const owners = await this.em.execute<{ id: string; name: string; items: number; collections: number }[]>(
      `select u.id, u.full_name as name,
              (select count(*)::int from library_items i where i.uploaded_by_id = u.id and i.status <> 'Draft') as items,
              (select count(*)::int from library_collections c where c.owner_id = u.id) as collections
         from users u
        where not u.is_active
          and (exists (select 1 from library_items i where i.uploaded_by_id = u.id and i.status <> 'Draft')
            or exists (select 1 from library_collections c where c.owner_id = u.id))
        order by u.full_name`,
    );
    const orphaned = await this.itemRows(
      `i.visibility = 'Departments' and i.status in ('Published', 'Archived')
       and not exists (select 1 from library_item_departments lid join departments d on d.id = lid.department_id
                        where lid.item_id = i.id and d.is_active)`,
    );
    const quarantined = await this.itemRows(`i.status = 'Quarantined'`);
    const scanErrors = await this.itemRows(`i.scan_status = 'Error' and i.status <> 'Quarantined'`);
    const failedPreviews = await this.itemRows(`i.preview_status = 'Failed' and i.status in ('Published', 'Archived')`);
    const [reports] = await this.em.execute<{ n: number }[]>(
      `select count(distinct coalesce(item_id::text, id::text))::int as n from library_reports where status = 'Open'`,
    );
    return {
      ownerDeactivated: owners.map((o) => ({ id: o.id, name: o.name, items: Number(o.items), collections: Number(o.collections) })),
      orphanedRestricted: orphaned,
      quarantined,
      scanErrors,
      failedPreviews,
      openReports: Number(reports?.n ?? 0),
    };
  }

  /**
   * Before a department is deactivated: restricted items and collections whose only active
   * department is this one (they'd become visible to curators and owners only).
   */
  async departmentImpact(departmentId: number, viewer: LibraryViewer): Promise<{ items: number; collections: number }> {
    this.assertCurator(viewer);
    const [items] = await this.em.execute<{ n: number }[]>(
      `select count(*)::int as n from library_items i
        where i.visibility = 'Departments' and i.status in ('Published', 'Archived')
          and exists (select 1 from library_item_departments x where x.item_id = i.id and x.department_id = ?)
          and not exists (select 1 from library_item_departments lid join departments d on d.id = lid.department_id
                           where lid.item_id = i.id and d.is_active and d.id <> ?)`,
      [departmentId, departmentId],
    );
    const [collections] = await this.em.execute<{ n: number }[]>(
      `select count(*)::int as n from library_collections c
        where c.visibility = 'Departments'
          and exists (select 1 from library_collection_departments x where x.collection_id = c.id and x.department_id = ?)
          and not exists (select 1 from library_collection_departments lcd join departments d on d.id = lcd.department_id
                           where lcd.collection_id = c.id and d.is_active and d.id <> ?)`,
      [departmentId, departmentId],
    );
    return { items: Number(items?.n ?? 0), collections: Number(collections?.n ?? 0) };
  }
}
