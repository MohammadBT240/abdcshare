import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, QueryOrder, raw, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import {
  EVENT,
  LibraryCollectionStatus,
  LibraryVisibility,
  type Paginated,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { OutboxService } from '../outbox/outbox.service';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { LibraryCollectionEntity } from './infrastructure/persistence/library-collection.entity';
import { LibraryCollectionItemEntity } from './infrastructure/persistence/library-collection-item.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import {
  canEditCollection,
  canSeeCollection,
  canSeeItem,
  collectionScopeSql,
  visibleItemSql,
  type CollectionAccess,
  type LibraryViewer,
} from './library-access';
import { slugify } from './library.constants';
import { LibraryService } from './library.service';
import type {
  AddCollectionItemsDto,
  CreateLibraryCollectionDto,
  LibraryCollectionItemDto,
  LibraryCollectionItemsQueryDto,
  LibraryCollectionListQueryDto,
  LibraryCollectionResponseDto,
  ReorderCollectionItemsDto,
  UpdateLibraryCollectionDto,
} from './presentation/dto/library-collection.dto';

/** ZIP export caps (D13). */
export const COLLECTION_EXPORT_MAX_FILES = 200;
export const COLLECTION_EXPORT_MAX_BYTES = 1024 * 1024 * 1024;

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/**
 * Library collections (S1): group items by the training / workshop / project they came from.
 * Visibility mirrors items (D9); membership never changes an item's own visibility.
 */
@Injectable()
export class LibraryCollectionsService {
  constructor(
    private readonly em: EntityManager,
    private readonly library: LibraryService,
    private readonly outbox: OutboxService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  // ------------------------------------------------------------------ helpers

  private access(c: LibraryCollectionEntity): CollectionAccess {
    return {
      status: c.status,
      visibility: c.visibility,
      ownerId: c.owner.id,
      departmentIds: c.departments.isInitialized() ? c.departments.getItems().map((d) => d.id) : [],
    };
  }

  private async find(id: string): Promise<LibraryCollectionEntity> {
    const c = await this.em.findOne(LibraryCollectionEntity, { id }, { populate: ['owner', 'departments'] });
    if (!c) throw new NotFoundException('Collection not found');
    return c;
  }

  private async findVisible(id: string, viewer: LibraryViewer): Promise<LibraryCollectionEntity> {
    const c = await this.find(id);
    if (!canSeeCollection(this.access(c), viewer)) throw new NotFoundException('Collection not found');
    return c;
  }

  private async findEditable(id: string, viewer: LibraryViewer): Promise<LibraryCollectionEntity> {
    const c = await this.findVisible(id, viewer);
    if (!canEditCollection(this.access(c), viewer)) {
      throw new ForbiddenException('Only the collection owner or a library curator can change it');
    }
    return c;
  }

  private validateUrl(url: string | null): string | null {
    if (!url) return null;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Link must be a valid https:// URL');
    }
    if (parsed.protocol !== 'https:') throw new BadRequestException('Link must start with https://');
    return parsed.toString();
  }

  private validateDates(startsOn: string | null, endsOn: string | null): void {
    if (startsOn && endsOn && endsOn < startsOn) throw new BadRequestException('End date is before the start date');
  }

  private async applyVisibility(
    c: LibraryCollectionEntity,
    visibility: LibraryVisibility,
    departmentIds: number[] | undefined,
  ): Promise<void> {
    c.visibility = visibility;
    if (visibility === LibraryVisibility.Firm) {
      c.departments.removeAll();
      return;
    }
    const ids = [...new Set(departmentIds ?? [])];
    if (ids.length === 0) throw new BadRequestException('Choose at least one department, or make it firm-wide');
    const departments = await this.em.find(DepartmentEntity, { id: { $in: ids }, isActive: true });
    if (departments.length !== ids.length) throw new BadRequestException('Unknown or inactive department');
    c.departments.set(departments);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'collection';
    for (let i = 0; i < 5; i++) {
      const slug = i === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      if (!(await this.em.findOne(LibraryCollectionEntity, { slug }))) return slug;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }

  /** Visible / hidden member counts per collection for this viewer. */
  private async counts(ids: string[], viewer: LibraryViewer): Promise<Map<string, { visible: number; total: number }>> {
    const out = new Map<string, { visible: number; total: number }>();
    if (ids.length === 0) return out;
    const vis = visibleItemSql('i', viewer);
    const rows = await this.em.getConnection().execute<{ collection_id: string; visible: number; total: number }[]>(
      `select ci.collection_id,
              count(*) filter (where ${vis.sql})::int as visible,
              count(*)::int as total
         from library_collection_items ci
         join library_items i on i.id = ci.item_id
        where ci.collection_id in (${placeholders(ids.length)})
        group by ci.collection_id`,
      [...vis.params, ...ids],
    );
    for (const r of rows) out.set(r.collection_id, { visible: Number(r.visible), total: Number(r.total) });
    return out;
  }

  private toDto(
    c: LibraryCollectionEntity,
    viewer: LibraryViewer,
    count?: { visible: number; total: number },
  ): LibraryCollectionResponseDto {
    const access = this.access(c);
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      type: c.type,
      description: c.description ?? null,
      startsOn: c.startsOn ?? null,
      endsOn: c.endsOn ?? null,
      facilitator: c.facilitator ?? null,
      venue: c.venue ?? null,
      externalUrl: c.externalUrl ?? null,
      visibility: c.visibility,
      departments: c.departments.isInitialized()
        ? c.departments
            .getItems()
            .map((d) => ({ id: d.id, name: d.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
      status: c.status,
      owner: { id: c.owner.id, name: c.owner.fullName },
      itemCount: count?.visible ?? 0,
      hiddenItemCount: count ? count.total - count.visible : 0,
      archivedAt: c.archivedAt ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      canEdit: canEditCollection(access, viewer),
      canDelete: canEditCollection(access, viewer) && c.status === LibraryCollectionStatus.Archived,
    };
  }

  // ------------------------------------------------------------------ CRUD

  async list(query: LibraryCollectionListQueryDto, viewer: LibraryViewer): Promise<Paginated<LibraryCollectionResponseDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const status = query.status ?? LibraryCollectionStatus.Active;
    if (status === LibraryCollectionStatus.Archived && !viewer.isCurator && !query.mine) {
      throw new BadRequestException('Archived collections are listed only under My uploads');
    }
    const where: Record<string, unknown> = { status };
    if (query.mine || (query.editable && !viewer.isCurator)) {
      where.owner = viewer.userId;
    } else if (!viewer.isCurator) {
      const scope = collectionScopeSql('__alias__', viewer);
      where[raw((alias) => scope.sql.replaceAll('__alias__', alias), scope.params)] = true;
    }
    if (query.type) where.type = query.type;
    if (query.year) where[raw((alias) => `extract(year from ${alias}.starts_on) = ?`, [query.year])] = true;
    const q = query.q?.trim();
    if (q) {
      const like = `%${likeEscape(q)}%`;
      where.$or = [{ title: { $ilike: like } }, { description: { $ilike: like } }, { facilitator: { $ilike: like } }];
    }
    const [rows, total] = await this.em.findAndCount(LibraryCollectionEntity, where as FilterQuery<LibraryCollectionEntity>, {
      populate: ['owner', 'departments'],
      strategy: 'select-in',
      orderBy: { startsOn: QueryOrder.DESC_NULLS_LAST, createdAt: QueryOrder.DESC, id: QueryOrder.ASC },
      limit,
      offset,
    });
    const counts = await this.counts(
      rows.map((r) => r.id),
      viewer,
    );
    return paginated(
      rows.map((r) => this.toDto(r, viewer, counts.get(r.id))),
      total,
      page,
      pageSize,
    );
  }

  async get(id: string, viewer: LibraryViewer): Promise<LibraryCollectionResponseDto> {
    const c = await this.findVisible(id, viewer);
    const counts = await this.counts([c.id], viewer);
    return this.toDto(c, viewer, counts.get(c.id));
  }

  async create(dto: CreateLibraryCollectionDto, viewer: LibraryViewer): Promise<LibraryCollectionResponseDto> {
    const title = clean(dto.title);
    if (!title) throw new BadRequestException('Title is required');
    const startsOn = dto.startsOn ?? null;
    const endsOn = dto.endsOn ?? null;
    this.validateDates(startsOn, endsOn);
    const c = this.em.create(LibraryCollectionEntity, {
      title,
      slug: await this.uniqueSlug(title),
      type: dto.type,
      description: clean(dto.description),
      startsOn,
      endsOn,
      facilitator: clean(dto.facilitator),
      venue: clean(dto.venue),
      externalUrl: this.validateUrl(clean(dto.externalUrl)),
      owner: this.em.getReference(UserEntity, viewer.userId),
    });
    await this.applyVisibility(c, dto.visibility ?? LibraryVisibility.Firm, dto.departmentIds);
    await this.em.persistAndFlush(c);
    return this.get(c.id, viewer);
  }

  async update(id: string, dto: UpdateLibraryCollectionDto, viewer: LibraryViewer): Promise<LibraryCollectionResponseDto> {
    const c = await this.findEditable(id, viewer);
    if (dto.title !== undefined) {
      const title = clean(dto.title);
      if (!title) throw new BadRequestException('Title is required');
      c.title = title;
    }
    if (dto.type !== undefined) c.type = dto.type;
    if (dto.description !== undefined) c.description = clean(dto.description);
    if (dto.startsOn !== undefined) c.startsOn = dto.startsOn ?? null;
    if (dto.endsOn !== undefined) c.endsOn = dto.endsOn ?? null;
    this.validateDates(c.startsOn ?? null, c.endsOn ?? null);
    if (dto.facilitator !== undefined) c.facilitator = clean(dto.facilitator);
    if (dto.venue !== undefined) c.venue = clean(dto.venue);
    if (dto.externalUrl !== undefined) c.externalUrl = this.validateUrl(clean(dto.externalUrl));
    if (dto.visibility !== undefined || dto.departmentIds !== undefined) {
      await this.applyVisibility(
        c,
        dto.visibility ?? c.visibility,
        dto.departmentIds ?? c.departments.getItems().map((d) => d.id),
      );
    }
    await this.em.flush();
    return this.get(c.id, viewer);
  }

  async archive(id: string, viewer: LibraryViewer): Promise<LibraryCollectionResponseDto> {
    const c = await this.findEditable(id, viewer);
    if (c.status !== LibraryCollectionStatus.Active) throw new ConflictException('Only active collections can be archived');
    c.status = LibraryCollectionStatus.Archived;
    c.archivedAt = new Date();
    await this.em.flush();
    return this.get(c.id, viewer);
  }

  async restore(id: string, viewer: LibraryViewer): Promise<LibraryCollectionResponseDto> {
    const c = await this.findEditable(id, viewer);
    if (c.status !== LibraryCollectionStatus.Archived) throw new ConflictException('Only archived collections can be restored');
    c.status = LibraryCollectionStatus.Active;
    c.archivedAt = null;
    await this.em.flush();
    return this.get(c.id, viewer);
  }

  /** Deleting a collection never deletes its items (D11). */
  async remove(id: string, viewer: LibraryViewer): Promise<void> {
    const c = await this.findEditable(id, viewer);
    if (c.status !== LibraryCollectionStatus.Archived) throw new ConflictException('Archive the collection before deleting it');
    await this.em.nativeDelete(LibraryCollectionItemEntity, { collection: c.id });
    await this.em.removeAndFlush(c);
  }

  // ------------------------------------------------------------------ membership

  /** Ordered items the viewer can see (Published + item visibility). */
  async items(id: string, query: LibraryCollectionItemsQueryDto, viewer: LibraryViewer): Promise<Paginated<LibraryCollectionItemDto>> {
    await this.findVisible(id, viewer);
    const { page, pageSize, limit, offset } = pageParams(query);
    const vis = visibleItemSql('i', viewer);
    const conn = this.em.getConnection();
    const base = `from library_collection_items ci join library_items i on i.id = ci.item_id where ci.collection_id = ? and ${vis.sql}`;
    const rows = await conn.execute<{ item_id: string; position: number; section: string | null }[]>(
      `select ci.item_id, ci.position, ci.section ${base} order by ci.position asc, ci.item_id asc limit ? offset ?`,
      [id, ...vis.params, limit, offset],
    );
    const totals = await conn.execute<{ total: number }[]>(`select count(*)::int as total ${base}`, [id, ...vis.params]);
    const items = rows.length
      ? await this.em.find(
          LibraryItemEntity,
          { id: { $in: rows.map((r) => r.item_id) } },
          { populate: ['category', 'uploadedBy', 'departments'], strategy: 'select-in' },
        )
      : [];
    const byId = new Map((await this.library.toDtos(items, viewer)).map((d) => [d.id, d]));
    return paginated(
      rows
        .filter((r) => byId.has(r.item_id))
        .map((r) => ({ position: r.position, section: r.section, item: byId.get(r.item_id)! })),
      Number(totals[0]?.total ?? 0),
      page,
      pageSize,
    );
  }

  /** Add existing items the viewer can see; needs edit rights on the collection (D10). */
  async addItems(id: string, dto: AddCollectionItemsDto, viewer: LibraryViewer): Promise<{ added: number }> {
    const c = await this.library.editableCollection(id, viewer);
    const ids = [...new Set(dto.itemIds)];
    const items = await this.em.find(LibraryItemEntity, { id: { $in: ids } }, { populate: ['uploadedBy', 'departments'] });
    const byId = new Map(items.map((i) => [i.id, i]));
    const ordered: LibraryItemEntity[] = [];
    for (const itemId of ids) {
      const item = byId.get(itemId);
      const visible =
        item &&
        canSeeItem(
          {
            status: item.status,
            visibility: item.visibility,
            uploadedById: item.uploadedBy.id,
            departmentIds: item.departments.getItems().map((d) => d.id),
          },
          viewer,
        );
      if (!item || !visible) throw new NotFoundException(`Library item ${itemId} not found`);
      ordered.push(item);
    }
    const added = await this.library.appendToCollection(c, ordered, dto.section, viewer);
    await this.em.flush();
    return { added };
  }

  async removeItem(id: string, itemId: string, viewer: LibraryViewer): Promise<void> {
    const c = await this.findEditable(id, viewer);
    const removed = await this.em.nativeDelete(LibraryCollectionItemEntity, { collection: c.id, item: itemId });
    if (!removed) throw new NotFoundException('That item is not in this collection');
  }

  /**
   * Re-order the listed items (and set their sections). Members the editor didn't send — e.g.
   * items they can't see — keep their relative order after the listed ones.
   */
  async reorder(id: string, dto: ReorderCollectionItemsDto, viewer: LibraryViewer): Promise<{ ok: true }> {
    const c = await this.findEditable(id, viewer);
    const members = await this.em.find(LibraryCollectionItemEntity, { collection: c.id }, { orderBy: { position: 'asc' } });
    const byItem = new Map(members.map((m) => [m.item.id, m]));
    const seen = new Set<string>();
    let position = 0;
    for (const entry of dto.items) {
      const m = byItem.get(entry.itemId);
      if (!m) throw new BadRequestException(`Item ${entry.itemId} is not in this collection`);
      if (seen.has(entry.itemId)) throw new BadRequestException('Each item can appear once');
      seen.add(entry.itemId);
      m.position = position++;
      if (entry.section !== undefined) m.section = clean(entry.section);
    }
    for (const m of members) if (!seen.has(m.item.id)) m.position = position++;
    await this.em.flush();
    return { ok: true };
  }

  // ------------------------------------------------------------------ ZIP export (D13)

  async requestExport(id: string, viewer: LibraryViewer): Promise<{ accepted: true; files: number }> {
    const c = await this.findVisible(id, viewer);
    const vis = visibleItemSql('i', viewer);
    const rows = await this.em.getConnection().execute<{ item_id: string; size_bytes: number | null }[]>(
      `select ci.item_id, i.size_bytes
         from library_collection_items ci join library_items i on i.id = ci.item_id
        where ci.collection_id = ? and i.storage_key is not null and ${vis.sql}
        order by ci.position asc`,
      [c.id, ...vis.params],
    );
    if (rows.length === 0) throw new BadRequestException('There are no files you can download in this collection');
    if (rows.length > COLLECTION_EXPORT_MAX_FILES) {
      throw new BadRequestException(`Collections over ${COLLECTION_EXPORT_MAX_FILES} files can't be zipped in one go`);
    }
    const bytes = rows.reduce((sum, r) => sum + Number(r.size_bytes ?? 0), 0);
    if (bytes > COLLECTION_EXPORT_MAX_BYTES) throw new BadRequestException('This collection is over 1 GB — download items individually');
    this.outbox.enqueue(EVENT.LibraryCollectionExportRequested, {
      collectionId: c.id,
      actorUserId: viewer.userId,
      itemIds: rows.map((r) => r.item_id),
    });
    await this.em.flush();
    return { accepted: true, files: rows.length };
  }

  async exportDownloadUrl(id: string, key: string, name: string | undefined, viewer: LibraryViewer): Promise<{ url: string }> {
    const c = await this.findVisible(id, viewer);
    const marker = `exports/library-collections/${c.id}/`;
    if (!key.startsWith(marker) && !key.includes(`/${marker}`)) throw new ForbiddenException('Invalid export key');
    const fileName = name?.replace(/[\\/]/g, '') || key.split('/').pop() || 'collection.zip';
    return { url: await this.storage.presignDownload(key, fileName, { disposition: 'attachment' }) };
  }
}
