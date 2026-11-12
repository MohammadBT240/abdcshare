import {
  ArrayType,
  Collection,
  Entity,
  Enum,
  Index,
  ManyToMany,
  ManyToOne,
  OptionalProps,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import {
  FilePreviewStatus,
  LibraryItemStatus,
  LibraryLicence,
  LibraryScanStatus,
  LibraryVisibility,
  PreviewErrorCode,
} from '@abdcshare/shared';
import { DepartmentEntity } from '../../../departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { LibraryCategoryEntity } from './library-category.entity';

/**
 * Weighted full-text document over the item's metadata (D3 — no file-content search).
 * `library_tags_text` is an IMMUTABLE wrapper created in the migration because
 * `array_to_string` is only STABLE and cannot appear in a generated column.
 *
 * Written in the shape Postgres normalises it to (`::text` on varchar columns, `'A'::"char"` weights)
 * so MikroORM's schema comparator sees no difference — otherwise every `migration:create`
 * would drop and re-add this column. Keep it in sync with Migration20261112130000.
 */
export const LIBRARY_SEARCH_VECTOR_SQL =
  `(setweight(to_tsvector('english', coalesce("title"::text, '')), 'A'::"char") || ` +
  `setweight(to_tsvector('english', coalesce(library_tags_text("tags"), '') || ' ' || coalesce("authors", '')), 'B'::"char") || ` +
  `setweight(to_tsvector('english', coalesce("description", '') || ' ' || coalesce("source", '') || ' ' || coalesce("file_name"::text, '')), 'C'::"char")) stored`;

/** A file in the staff knowledge library. One file per item (v1). */
@Entity({ tableName: 'library_items' })
@Index({ name: 'library_items_browse_idx', properties: ['status', 'category', 'publishedAt', 'id'] })
@Index({ name: 'library_items_tags_idx', properties: ['tags'], type: 'gin' })
@Index({ name: 'library_items_search_vector_idx', properties: ['searchVector'], type: 'fulltext' })
export class LibraryItemEntity {
  [OptionalProps]?:
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'visibility'
    | 'tags'
    | 'previewStatus'
    | 'viewCount'
    | 'downloadCount'
    | 'searchVector'
    | 'licence'
    | 'downloadable'
    | 'scanStatus'
    | 'scanAttempts';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ length: 300 })
  title!: string;

  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @ManyToOne(() => LibraryCategoryEntity)
  category!: LibraryCategoryEntity;

  /** Free text — authors are often external to the firm. */
  @Property({ type: 'text', nullable: true })
  authors?: string | null;

  @Property({ type: 'integer', nullable: true })
  @Index()
  publishedYear?: number | null;

  /** Publisher, journal or URL. */
  @Property({ type: 'text', nullable: true })
  source?: string | null;

  /** Lower-cased, trimmed, de-duplicated. */
  @Property({ type: ArrayType, columnType: 'text[]', defaultRaw: `'{}'` })
  tags: string[] = [];

  @Enum({ items: () => LibraryVisibility, default: LibraryVisibility.Firm })
  visibility: LibraryVisibility = LibraryVisibility.Firm;

  /** Only meaningful when visibility = Departments. */
  @ManyToMany(() => DepartmentEntity, undefined, {
    pivotTable: 'library_item_departments',
    joinColumn: 'item_id',
    inverseJoinColumn: 'department_id',
  })
  departments = new Collection<DepartmentEntity>(this);

  @Enum({ items: () => LibraryItemStatus, default: LibraryItemStatus.Draft })
  status: LibraryItemStatus = LibraryItemStatus.Draft;

  // ---- file (null until the Uppy upload is confirmed) ----
  @Property({ nullable: true })
  storageKey?: string | null;

  @Property({ nullable: true })
  fileName?: string | null;

  @Property({ nullable: true })
  mimeType?: string | null;

  @Property({ type: 'integer', nullable: true })
  sizeBytes?: number | null;

  // ---- preview (same column names as submission_files / document_files; the worker writes these) ----
  @Property({ nullable: true })
  previewStorageKey?: string | null;

  @Enum({ items: () => FilePreviewStatus, default: FilePreviewStatus.None })
  previewStatus: FilePreviewStatus = FilePreviewStatus.None;

  @Property({ type: 'text', nullable: true })
  previewError?: string | null;

  /** Classified conversion failure (S3, D28) — drives a specific message in the viewer. */
  @Enum({ items: () => PreviewErrorCode, nullable: true })
  previewErrorCode?: PreviewErrorCode | null;

  // ---- virus scan (S3, D24) — written by the worker ----
  @Enum({ items: () => LibraryScanStatus, default: LibraryScanStatus.Pending })
  scanStatus: LibraryScanStatus = LibraryScanStatus.Pending;

  @Property({ type: 'timestamptz', nullable: true })
  scannedAt?: Date | null;

  @Property({ default: 0 })
  scanAttempts: number = 0;

  @Property({ type: 'text', nullable: true })
  scanError?: string | null;

  /** SHA-256 of the stored file, hex — computed by the worker while scanning (D27). */
  @Property({ type: 'string', columnType: 'char(64)', nullable: true })
  @Index({ name: 'library_items_content_hash_idx' })
  contentHash?: string | null;

  // ---- ownership & lifecycle ----
  @ManyToOne(() => UserEntity)
  @Index()
  uploadedBy!: UserEntity;

  @Property({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  archivedBy?: UserEntity | null;

  @Property({ type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;

  // ---- sharing (S2) ----
  @Enum({ items: () => LibraryLicence, default: LibraryLicence.InternalUseOnly })
  licence: LibraryLicence = LibraryLicence.InternalUseOnly;

  @Property({ type: 'text', nullable: true })
  licenceNote?: string | null;

  /** View-only when false: download is refused to everyone but editors (D22). */
  @Property({ default: true })
  downloadable: boolean = true;

  /** Upload declaration (D18) — set on create and on every file replacement. */
  @Property({ type: 'timestamptz', nullable: true })
  declaredAt?: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  declaredBy?: UserEntity | null;

  @Property({ default: 0 })
  viewCount: number = 0;

  @Property({ default: 0 })
  downloadCount: number = 0;

  /** Generated by Postgres (MikroORM treats `generated` props as virtual on insert/update); lazy so lists don't select it. */
  @Property({
    columnType: 'tsvector',
    generated: LIBRARY_SEARCH_VECTOR_SQL,
    lazy: true,
    hidden: true,
    nullable: true,
  })
  searchVector?: string;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
