import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, QueryOrder, raw, type FilterQuery, type QueryOrderMap } from '@mikro-orm/postgresql';
import {
  EVENT,
  FilePreviewStatus,
  LibraryItemStatus,
  LibraryVisibility,
  hasPermission,
  type Paginated,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import {
  initialPreviewStatus,
  isBlockedPreviewType,
  isNativePreviewable,
  isOfficeMime,
} from '../../common/storage/preview.util';
import type {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import { OutboxService } from '../outbox/outbox.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import { LibraryCategoryEntity } from './infrastructure/persistence/library-category.entity';
import { LibraryCollectionEntity } from './infrastructure/persistence/library-collection.entity';
import { LibraryCollectionItemEntity } from './infrastructure/persistence/library-collection-item.entity';
import {
  canEditCollection,
  canEditItem,
  canSeeCollection,
  canSeeItem,
  libraryScopeSql,
  visibleCollectionSql,
  type LibraryAccessItem,
  type LibraryViewer,
} from './library-access';
import {
  LIBRARY_FILE_EXT,
  LIBRARY_KEY_PREFIX,
  LIBRARY_MAX_BYTES,
  LIBRARY_MAX_TAGS,
  LIBRARY_MAX_TAG_LENGTH,
  LIBRARY_MIME_TYPES,
  LIBRARY_SORTS,
  LIBRARY_UPLOAD_ERROR,
  mimeTypesFor,
  normalizeTags,
} from './library.constants';
import type {
  CreateLibraryItemDto,
  LibraryConfirmDto,
  LibraryDownloadDto,
  LibraryItemListQueryDto,
  LibraryItemResponseDto,
  LibraryPresignDto,
  LibraryPresignedUploadDto,
  LibraryPreviewDto,
  LibraryTagDto,
  LibraryTagQueryDto,
  UpdateLibraryItemDto,
} from './presentation/dto/library.dto';

const ITEM_POPULATE = ['category', 'uploadedBy', 'departments'] as const;

/** Escape LIKE wildcards in user input. */
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function clean(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * Staff knowledge library — items, uploads, in-browser preview, tags.
 * Visibility (design §5) is enforced here for every read path; the web only mirrors it.
 */
@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly outbox: OutboxService,
  ) {}

  // ------------------------------------------------------------------ viewer

  /** Resolve department + curator flag once per request (department is not on the JWT). */
  async viewer(user: AuthenticatedUser): Promise<LibraryViewer> {
    const row = await this.em.findOne(UserEntity, { id: user.userId }, { fields: ['id', 'department'] });
    return {
      userId: user.userId,
      departmentId: row?.department?.id ?? null,
      isCurator: hasPermission(user.role, 'library:curate', user.partnerDesignation),
    };
  }

  // ------------------------------------------------------------------ mapping

  private access(item: LibraryItemEntity): LibraryAccessItem {
    return {
      status: item.status,
      visibility: item.visibility,
      uploadedById: item.uploadedBy.id,
      departmentIds: item.departments.isInitialized() ? item.departments.getItems().map((d) => d.id) : [],
    };
  }

  toDto(
    item: LibraryItemEntity,
    viewer: LibraryViewer,
    collections: LibraryItemResponseDto['collections'] = [],
  ): LibraryItemResponseDto {
    const departments = item.departments.isInitialized()
      ? item.departments
          .getItems()
          .map((d) => ({ id: d.id, name: d.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
    const deletable = item.status === LibraryItemStatus.Archived || item.status === LibraryItemStatus.Draft;
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      category: { id: item.category.id, name: item.category.name },
      authors: item.authors ?? null,
      publishedYear: item.publishedYear ?? null,
      source: item.source ?? null,
      tags: item.tags ?? [],
      visibility: item.visibility,
      departments,
      status: item.status,
      fileName: item.fileName ?? null,
      mimeType: item.mimeType ?? null,
      sizeBytes: item.sizeBytes ?? null,
      fileType: item.mimeType ? (LIBRARY_MIME_TYPES[item.mimeType] ?? null) : null,
      previewStatus: item.previewStatus,
      uploadedBy: { id: item.uploadedBy.id, name: item.uploadedBy.fullName },
      publishedAt: item.publishedAt ?? null,
      archivedAt: item.archivedAt ?? null,
      viewCount: item.viewCount,
      downloadCount: item.downloadCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      collections,
      canEdit: canEditItem({ uploadedById: item.uploadedBy.id }, viewer),
      canDelete: viewer.isCurator && deletable,
    };
  }

  /** Collections (visible to the viewer) each item belongs to, keyed by item id. */
  async collectionsFor(
    itemIds: string[],
    viewer: LibraryViewer,
  ): Promise<Map<string, LibraryItemResponseDto['collections']>> {
    const out = new Map<string, LibraryItemResponseDto['collections']>();
    if (itemIds.length === 0) return out;
    const scope = visibleCollectionSql('c', viewer);
    const rows = await this.em.getConnection().execute<
      { item_id: string; id: string; title: string; type: string; section: string | null }[]
    >(
      `select ci.item_id, c.id, c.title, c.type, ci.section
         from library_collection_items ci
         join library_collections c on c.id = ci.collection_id
        where ci.item_id in (${itemIds.map(() => '?').join(', ')}) and ${scope.sql}
        order by c.starts_on desc nulls last, c.title asc`,
      [...itemIds, ...scope.params],
    );
    for (const r of rows) {
      const list = out.get(r.item_id) ?? [];
      list.push({ id: r.id, title: r.title, type: r.type, section: r.section });
      out.set(r.item_id, list);
    }
    return out;
  }

  // ------------------------------------------------------------------ lookups

  private async findItem(id: string): Promise<LibraryItemEntity> {
    const item = await this.em.findOne(LibraryItemEntity, { id }, { populate: [...ITEM_POPULATE] });
    if (!item) throw new NotFoundException('Library item not found');
    return item;
  }

  /** 404 (not 403) when hidden, so restricted items don't leak their existence. */
  private async findVisible(id: string, viewer: LibraryViewer): Promise<LibraryItemEntity> {
    const item = await this.findItem(id);
    if (!canSeeItem(this.access(item), viewer)) throw new NotFoundException('Library item not found');
    return item;
  }

  private async findEditable(id: string, viewer: LibraryViewer): Promise<LibraryItemEntity> {
    const item = await this.findVisible(id, viewer);
    if (!canEditItem(this.access(item), viewer)) {
      throw new ForbiddenException('Only the uploader or a library curator can change this item');
    }
    return item;
  }

  private async activeCategory(id: string): Promise<LibraryCategoryEntity> {
    const category = await this.em.findOne(LibraryCategoryEntity, { id, isActive: true });
    if (!category) throw new BadRequestException('Choose an active library category');
    return category;
  }

  // ------------------------------------------------------------------ validation helpers

  private tagsFrom(raw: string[] | undefined): string[] {
    const tags = normalizeTags(raw);
    if (tags.length > LIBRARY_MAX_TAGS) throw new BadRequestException(`Use at most ${LIBRARY_MAX_TAGS} tags`);
    if (tags.some((t) => t.length > LIBRARY_MAX_TAG_LENGTH)) {
      throw new BadRequestException(`Tags must be ${LIBRARY_MAX_TAG_LENGTH} characters or fewer`);
    }
    return tags;
  }

  private async applyVisibility(
    item: LibraryItemEntity,
    visibility: LibraryVisibility,
    departmentIds: number[] | undefined,
  ): Promise<void> {
    item.visibility = visibility;
    if (visibility === LibraryVisibility.Firm) {
      item.departments.removeAll();
      return;
    }
    const ids = [...new Set(departmentIds ?? [])];
    if (ids.length === 0) {
      throw new BadRequestException('Choose at least one department, or make the item firm-wide');
    }
    const departments = await this.em.find(DepartmentEntity, { id: { $in: ids }, isActive: true });
    if (departments.length !== ids.length) throw new BadRequestException('Unknown or inactive department');
    item.departments.set(departments);
  }

  private validateFile(fileName: string, mimeType: string, sizeBytes?: number): void {
    if (
      !LIBRARY_MIME_TYPES[mimeType] ||
      !LIBRARY_FILE_EXT.test(fileName) ||
      isBlockedPreviewType(mimeType, fileName)
    ) {
      throw new BadRequestException(LIBRARY_UPLOAD_ERROR);
    }
    if (sizeBytes != null && sizeBytes > LIBRARY_MAX_BYTES) {
      throw new BadRequestException('File must be 100 MB or smaller');
    }
  }

  private keyPrefix(id: string): string {
    return `${LIBRARY_KEY_PREFIX}/${id}`;
  }

  /** Keys must come from this item's folder (optionally under the bucket object prefix). */
  private assertKeyForItem(id: string, storageKey: string): void {
    const marker = `${this.keyPrefix(id)}/`;
    if (!(storageKey.startsWith(marker) || storageKey.includes(`/${marker}`))) {
      throw new BadRequestException('Invalid storage key for this library item');
    }
  }

  private assertNotArchived(item: LibraryItemEntity): void {
    if (item.status === LibraryItemStatus.Archived) {
      throw new ConflictException('Restore the item before changing its file');
    }
  }

  private async deleteObjects(keys: (string | null | undefined)[]): Promise<void> {
    const unique = [...new Set(keys.filter((k): k is string => Boolean(k)))];
    const results = await Promise.allSettled(unique.map((k) => this.storage.delete(k)));
    results.forEach((r, i) => {
      if (r.status === 'rejected') this.logger.warn(`Failed to delete object ${unique[i]}: ${String(r.reason)}`);
    });
  }

  private async bump(id: string, column: 'view_count' | 'download_count'): Promise<void> {
    await this.em
      .getConnection()
      .execute(`update "library_items" set "${column}" = "${column}" + 1 where "id" = ?`, [id]);
  }

  // ------------------------------------------------------------------ list / get

  async list(query: LibraryItemListQueryDto, viewer: LibraryViewer): Promise<Paginated<LibraryItemResponseDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const status = query.status ?? LibraryItemStatus.Published;
    if (status === LibraryItemStatus.Archived && !viewer.isCurator && !query.mine) {
      throw new BadRequestException('Archived items are listed only under My uploads');
    }

    const where: Record<string, unknown> = { status };
    if (query.mine) {
      where.uploadedBy = viewer.userId;
    } else if (!viewer.isCurator) {
      const scope = libraryScopeSql('__alias__', viewer);
      where[raw((alias) => scope.sql.replaceAll('__alias__', alias), scope.params)] = true;
    }
    if (query.categoryId) where.category = query.categoryId;
    if (query.collectionId) {
      where[
        raw(
          (alias) =>
            `exists (select 1 from library_collection_items fc where fc.item_id = ${alias}.id and fc.collection_id = ?)`,
          [query.collectionId],
        )
      ] = true;
    }
    if (query.year) where.publishedYear = query.year;
    if (query.fileType) where.mimeType = { $in: mimeTypesFor(query.fileType) };
    if (query.departmentId) {
      where[
        raw(
          (alias) =>
            `exists (select 1 from library_item_departments f where f.item_id = ${alias}.id and f.department_id = ?)`,
          [query.departmentId],
        )
      ] = true;
    }
    const tag = normalizeTags(query.tag ? [query.tag] : [])[0];
    if (tag) where[raw((alias) => `(? = any(${alias}.tags))`, [tag])] = true;

    const q = query.q?.trim();
    if (q) {
      where[
        raw(
          (alias) =>
            `(${alias}.search_vector @@ websearch_to_tsquery('english', ?) or ${alias}.title ilike ?)`,
          [q, `%${likeEscape(q)}%`],
        )
      ] = true;
    }

    if (query.sort && !(LIBRARY_SORTS as readonly string[]).includes(query.sort)) {
      throw new BadRequestException(`sort must be one of: ${LIBRARY_SORTS.join(', ')}`);
    }
    const sort = query.sort ?? (q ? 'relevance' : 'newest');
    let orderBy: QueryOrderMap<LibraryItemEntity>;
    switch (sort) {
      case 'title':
        orderBy = { title: QueryOrder.ASC, id: QueryOrder.ASC };
        break;
      case 'views':
        orderBy = { viewCount: QueryOrder.DESC, publishedAt: QueryOrder.DESC_NULLS_LAST, id: QueryOrder.ASC };
        break;
      case 'downloads':
        orderBy = { downloadCount: QueryOrder.DESC, publishedAt: QueryOrder.DESC_NULLS_LAST, id: QueryOrder.ASC };
        break;
      case 'relevance':
        if (q) {
          orderBy = {
            [raw((alias) => `ts_rank(${alias}.search_vector, websearch_to_tsquery('english', ?))`, [q])]:
              QueryOrder.DESC,
            publishedAt: QueryOrder.DESC_NULLS_LAST,
            id: QueryOrder.ASC,
          } as QueryOrderMap<LibraryItemEntity>;
          break;
        }
      // falls through — relevance without a query is "newest"
      default:
        orderBy = { publishedAt: QueryOrder.DESC_NULLS_LAST, createdAt: QueryOrder.DESC, id: QueryOrder.ASC };
    }

    const [rows, total] = await this.em.findAndCount(LibraryItemEntity, where as FilterQuery<LibraryItemEntity>, {
      populate: [...ITEM_POPULATE],
      strategy: 'select-in',
      orderBy,
      limit,
      offset,
    });
    const collections = await this.collectionsFor(
      rows.map((r) => r.id),
      viewer,
    );
    return paginated(
      rows.map((r) => this.toDto(r, viewer, collections.get(r.id))),
      total,
      page,
      pageSize,
    );
  }

  async get(id: string, viewer: LibraryViewer): Promise<LibraryItemResponseDto> {
    const item = await this.findVisible(id, viewer);
    const collections = await this.collectionsFor([item.id], viewer);
    return this.toDto(item, viewer, collections.get(item.id));
  }

  /** Map already-loaded items to DTOs with their collections (used by collection pages). */
  async toDtos(items: LibraryItemEntity[], viewer: LibraryViewer): Promise<LibraryItemResponseDto[]> {
    const collections = await this.collectionsFor(
      items.map((i) => i.id),
      viewer,
    );
    return items.map((i) => this.toDto(i, viewer, collections.get(i.id)));
  }

  /** Load a collection the viewer may add items to (owner or curator), or throw. */
  async editableCollection(id: string, viewer: LibraryViewer): Promise<LibraryCollectionEntity> {
    const c = await this.em.findOne(LibraryCollectionEntity, { id }, { populate: ['owner', 'departments'] });
    const access = c && {
      status: c.status,
      visibility: c.visibility,
      ownerId: c.owner.id,
      departmentIds: c.departments.getItems().map((d) => d.id),
    };
    if (!c || !access || !canSeeCollection(access, viewer)) throw new NotFoundException('Collection not found');
    if (!canEditCollection(access, viewer)) {
      throw new ForbiddenException('Only the collection owner or a library curator can add items to it');
    }
    if (c.status !== 'Active') throw new ConflictException('Restore the collection before adding items');
    return c;
  }

  /** Append items to a collection at the end, in the given order (skips existing members). */
  async appendToCollection(
    collection: LibraryCollectionEntity,
    items: LibraryItemEntity[],
    section: string | null | undefined,
    viewer: LibraryViewer,
  ): Promise<number> {
    const existing = await this.em.find(LibraryCollectionItemEntity, { collection: collection.id }, { fields: ['item', 'position'] });
    const present = new Set(existing.map((m) => m.item.id));
    let next = existing.reduce((max, m) => Math.max(max, m.position), -1) + 1;
    let added = 0;
    for (const item of items) {
      if (present.has(item.id)) continue;
      this.em.persist(
        this.em.create(LibraryCollectionItemEntity, {
          collection,
          item,
          position: next++,
          section: clean(section ?? undefined),
          addedBy: this.em.getReference(UserEntity, viewer.userId),
        }),
      );
      present.add(item.id);
      added += 1;
    }
    return added;
  }

  // ------------------------------------------------------------------ create / update

  /** Step 1 of an upload: a Draft with metadata. It is published when its file is confirmed. */
  async create(dto: CreateLibraryItemDto, viewer: LibraryViewer): Promise<LibraryItemResponseDto> {
    const title = clean(dto.title);
    if (!title) throw new BadRequestException('Title is required');
    const category = await this.activeCategory(dto.categoryId);
    const collection = dto.collectionId ? await this.editableCollection(dto.collectionId, viewer) : null;
    const item = this.em.create(LibraryItemEntity, {
      title,
      description: clean(dto.description),
      category,
      authors: clean(dto.authors),
      publishedYear: dto.publishedYear ?? null,
      source: clean(dto.source),
      tags: this.tagsFrom(dto.tags),
      uploadedBy: this.em.getReference(UserEntity, viewer.userId),
      status: LibraryItemStatus.Draft,
    });
    // Uploading into a restricted collection defaults the item to the same departments (D9).
    const inherit = !dto.visibility && collection?.visibility === LibraryVisibility.Departments;
    await this.applyVisibility(
      item,
      inherit ? LibraryVisibility.Departments : (dto.visibility ?? LibraryVisibility.Firm),
      inherit ? collection!.departments.getItems().map((d) => d.id) : dto.departmentIds,
    );
    this.em.persist(item);
    if (collection) await this.appendToCollection(collection, [item], dto.section, viewer);
    await this.em.flush();
    return this.get(item.id, viewer);
  }

  async update(id: string, dto: UpdateLibraryItemDto, viewer: LibraryViewer): Promise<LibraryItemResponseDto> {
    const item = await this.findEditable(id, viewer);
    if (dto.title !== undefined) {
      const title = clean(dto.title);
      if (!title) throw new BadRequestException('Title is required');
      item.title = title;
    }
    if (dto.categoryId !== undefined && dto.categoryId !== item.category.id) {
      item.category = await this.activeCategory(dto.categoryId);
    }
    if (dto.description !== undefined) item.description = clean(dto.description);
    if (dto.authors !== undefined) item.authors = clean(dto.authors);
    if (dto.publishedYear !== undefined) item.publishedYear = dto.publishedYear ?? null;
    if (dto.source !== undefined) item.source = clean(dto.source);
    if (dto.tags !== undefined) item.tags = this.tagsFrom(dto.tags);
    if (dto.visibility !== undefined || dto.departmentIds !== undefined) {
      const visibility = dto.visibility ?? item.visibility;
      const current = item.departments.getItems().map((d) => d.id);
      await this.applyVisibility(item, visibility, dto.departmentIds ?? current);
    }
    await this.em.flush();
    return this.toDto(item, viewer);
  }

  // ------------------------------------------------------------------ upload (presign / multipart / confirm)

  async presignUpload(id: string, dto: LibraryPresignDto, viewer: LibraryViewer): Promise<LibraryPresignedUploadDto> {
    const item = await this.findEditable(id, viewer);
    this.assertNotArchived(item);
    this.validateFile(dto.fileName, dto.contentType);
    return this.storage.presignUpload({
      keyPrefix: this.keyPrefix(id),
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async createMultipart(id: string, dto: MultipartCreateDto, viewer: LibraryViewer) {
    const item = await this.findEditable(id, viewer);
    this.assertNotArchived(item);
    this.validateFile(dto.fileName, dto.contentType, dto.sizeBytes);
    return this.storage.createMultipart({
      keyPrefix: this.keyPrefix(id),
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async signMultipartParts(id: string, uploadId: string, dto: MultipartSignPartsDto, viewer: LibraryViewer) {
    await this.findEditable(id, viewer);
    this.assertKeyForItem(id, dto.storageKey);
    const parts = await Promise.all(
      dto.partNumbers.map(async (partNumber) => {
        const { url } = await this.storage.presignPart(dto.storageKey, uploadId, partNumber);
        return { partNumber, url };
      }),
    );
    return { parts };
  }

  async completeMultipart(
    id: string,
    uploadId: string,
    dto: MultipartCompleteDto,
    viewer: LibraryViewer,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.findEditable(id, viewer);
    this.assertNotArchived(item);
    this.assertKeyForItem(id, dto.storageKey);
    this.validateFile(dto.fileName, dto.mimeType ?? '', dto.sizeBytes);
    await this.storage.completeMultipart(dto.storageKey, uploadId, dto.parts);
    return this.confirmUpload(
      id,
      { storageKey: dto.storageKey, fileName: dto.fileName, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes },
      viewer,
    );
  }

  async abortMultipart(id: string, uploadId: string, dto: MultipartAbortDto, viewer: LibraryViewer) {
    await this.findEditable(id, viewer);
    this.assertKeyForItem(id, dto.storageKey);
    await this.storage.abortMultipart(dto.storageKey, uploadId);
    return { ok: true as const };
  }

  /**
   * Attach (or replace) the item's file. Publishes a Draft. Office files get a preview job
   * written to the outbox in the same flush; the old object + old preview are removed after commit.
   */
  async confirmUpload(id: string, dto: LibraryConfirmDto, viewer: LibraryViewer): Promise<LibraryItemResponseDto> {
    const item = await this.findEditable(id, viewer);
    this.assertNotArchived(item);
    this.assertKeyForItem(id, dto.storageKey);

    const head = await this.storage.head(dto.storageKey);
    if (!head) throw new BadRequestException('Uploaded object not found');
    if (dto.sizeBytes != null && dto.sizeBytes > 0 && head.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(`Uploaded size mismatch (expected ${dto.sizeBytes}, got ${head.sizeBytes})`);
    }
    const mimeType = dto.mimeType || '';
    this.validateFile(dto.fileName, mimeType, head.sizeBytes);

    const superseded = [item.storageKey, item.previewStorageKey].filter((k) => k && k !== dto.storageKey);

    item.storageKey = dto.storageKey;
    item.fileName = dto.fileName;
    item.mimeType = mimeType;
    item.sizeBytes = head.sizeBytes;
    item.previewStorageKey = null;
    item.previewError = null;
    item.previewStatus = initialPreviewStatus(mimeType, dto.fileName);
    if (item.status === LibraryItemStatus.Draft) {
      item.status = LibraryItemStatus.Published;
      item.publishedAt = new Date();
    }
    if (item.previewStatus === FilePreviewStatus.Pending) {
      this.outbox.enqueue(EVENT.FilePreviewRequested, {
        entityType: 'library_item',
        fileId: item.id,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType,
      });
    }
    await this.em.flush();
    await this.deleteObjects(superseded);
    return this.toDto(item, viewer);
  }

  // ------------------------------------------------------------------ archive / restore / delete

  async archive(id: string, viewer: LibraryViewer): Promise<LibraryItemResponseDto> {
    const item = await this.findEditable(id, viewer);
    if (item.status !== LibraryItemStatus.Published) {
      throw new ConflictException('Only published items can be archived');
    }
    item.status = LibraryItemStatus.Archived;
    item.archivedAt = new Date();
    item.archivedBy = this.em.getReference(UserEntity, viewer.userId);
    await this.em.flush();
    return this.toDto(item, viewer);
  }

  async restore(id: string, viewer: LibraryViewer): Promise<LibraryItemResponseDto> {
    const item = await this.findEditable(id, viewer);
    if (item.status !== LibraryItemStatus.Archived) {
      throw new ConflictException('Only archived items can be restored');
    }
    item.status = LibraryItemStatus.Published;
    item.archivedAt = null;
    item.archivedBy = null;
    await this.em.flush();
    return this.toDto(item, viewer);
  }

  /** Curators only (route-guarded); archived (or abandoned draft) items only. */
  async remove(id: string, viewer: LibraryViewer): Promise<void> {
    if (!viewer.isCurator) throw new ForbiddenException('Only library curators can delete items');
    const item = await this.findItem(id);
    if (item.status === LibraryItemStatus.Published) {
      throw new ConflictException('Archive the item before deleting it');
    }
    const keys = [item.storageKey, item.previewStorageKey];
    await this.em.removeAndFlush(item);
    await this.deleteObjects(keys);
  }

  // ------------------------------------------------------------------ preview / download

  async preview(id: string, viewer: LibraryViewer, opts?: { retry?: boolean }): Promise<LibraryPreviewDto> {
    const item = await this.findVisible(id, viewer);
    if (!item.storageKey || !item.fileName) {
      return { url: null, mode: 'unavailable', previewStatus: FilePreviewStatus.None, reason: 'unsupported' };
    }

    if (item.previewStatus === FilePreviewStatus.Ready && item.previewStorageKey) {
      const url = await this.storage.presignDownload(item.previewStorageKey, `${item.fileName}.pdf`, {
        disposition: 'inline',
      });
      await this.bump(item.id, 'view_count');
      return { url, mode: 'converted', previewStatus: item.previewStatus };
    }

    if (isNativePreviewable(item.mimeType, item.fileName)) {
      const url = await this.storage.presignDownload(item.storageKey, item.fileName, { disposition: 'inline' });
      await this.bump(item.id, 'view_count');
      return { url, mode: 'native', previewStatus: FilePreviewStatus.Ready };
    }

    if (isOfficeMime(item.mimeType, item.fileName)) {
      if (item.previewStatus === FilePreviewStatus.Failed && opts?.retry && canEditItem(this.access(item), viewer)) {
        item.previewStatus = FilePreviewStatus.Pending;
        item.previewError = null;
        this.outbox.enqueue(EVENT.FilePreviewRequested, {
          entityType: 'library_item',
          fileId: item.id,
          storageKey: item.storageKey,
          fileName: item.fileName,
          mimeType: item.mimeType ?? null,
        });
        await this.em.flush();
      }
      if (item.previewStatus === FilePreviewStatus.Pending) {
        return { url: null, mode: 'unavailable', previewStatus: item.previewStatus, reason: 'pending' };
      }
      if (item.previewStatus === FilePreviewStatus.Failed) {
        return { url: null, mode: 'unavailable', previewStatus: item.previewStatus, reason: 'failed' };
      }
    }

    return { url: null, mode: 'unavailable', previewStatus: item.previewStatus, reason: 'unsupported' };
  }

  async download(id: string, viewer: LibraryViewer): Promise<LibraryDownloadDto> {
    const item = await this.findVisible(id, viewer);
    if (!item.storageKey || !item.fileName) throw new NotFoundException('This item has no file yet');
    const url = await this.storage.presignDownload(item.storageKey, item.fileName);
    await this.bump(item.id, 'download_count');
    return { url };
  }

  // ------------------------------------------------------------------ tags

  /** Tag autocomplete: distinct tags on Published items the viewer can see, most used first. */
  async tags(query: LibraryTagQueryDto, viewer: LibraryViewer): Promise<Paginated<LibraryTagDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const scope = libraryScopeSql('i', viewer);
    const prefix = query.q?.trim().toLowerCase();
    const filters = [`i.status = 'Published'`, scope.sql];
    const params: unknown[] = [...scope.params];
    if (prefix) {
      filters.push(`t.tag like ?`);
      params.push(`${likeEscape(prefix)}%`);
    }
    const from = `from "library_items" i cross join lateral unnest(i.tags) as t(tag) where ${filters.join(' and ')}`;
    const conn = this.em.getConnection();
    const rows = await conn.execute<{ tag: string; count: number }[]>(
      `select t.tag as tag, count(*)::int as count ${from} group by t.tag order by count(*) desc, t.tag asc limit ? offset ?`,
      [...params, limit, offset],
    );
    const totals = await conn.execute<{ total: number }[]>(
      `select count(distinct t.tag)::int as total ${from}`,
      params,
    );
    return paginated(
      rows.map((r) => ({ tag: r.tag, count: Number(r.count) })),
      Number(totals[0]?.total ?? 0),
      page,
      pageSize,
    );
  }
}
