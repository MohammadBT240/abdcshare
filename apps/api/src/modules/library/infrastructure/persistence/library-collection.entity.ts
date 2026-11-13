import {
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
import { LibraryCollectionStatus, LibraryCollectionType, LibraryVisibility } from '@abdcshare/shared';
import { DepartmentEntity } from '../../../departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/**
 * A group of library items that belong to one thing — a training, workshop, conference,
 * project or programme (D7). Independent of categories; an item can be in many collections.
 * Visibility is the collection's own and is never inherited by its items (D9).
 */
@Entity({ tableName: 'library_collections' })
@Index({ name: 'library_collections_browse_idx', properties: ['status', 'startsOn', 'id'] })
export class LibraryCollectionEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'updatedAt' | 'status' | 'visibility';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ length: 200 })
  title!: string;

  @Property({ unique: true })
  slug!: string;

  @Enum({ items: () => LibraryCollectionType })
  type!: LibraryCollectionType;

  @Property({ type: 'text', nullable: true })
  description?: string | null;

  /** ISO date (YYYY-MM-DD) — when the training/event started. */
  @Property({ columnType: 'date', type: 'string', nullable: true })
  startsOn?: string | null;

  @Property({ columnType: 'date', type: 'string', nullable: true })
  endsOn?: string | null;

  @Property({ type: 'text', nullable: true })
  facilitator?: string | null;

  @Property({ type: 'text', nullable: true })
  venue?: string | null;

  /** https only — e.g. the abdchub event page or a recording. */
  @Property({ type: 'text', nullable: true })
  externalUrl?: string | null;

  @Enum({ items: () => LibraryVisibility, default: LibraryVisibility.Firm })
  visibility: LibraryVisibility = LibraryVisibility.Firm;

  @ManyToMany(() => DepartmentEntity, undefined, {
    pivotTable: 'library_collection_departments',
    joinColumn: 'collection_id',
    inverseJoinColumn: 'department_id',
  })
  departments = new Collection<DepartmentEntity>(this);

  @Enum({ items: () => LibraryCollectionStatus, default: LibraryCollectionStatus.Active })
  status: LibraryCollectionStatus = LibraryCollectionStatus.Active;

  @ManyToOne(() => UserEntity)
  @Index()
  owner!: UserEntity;

  @Property({ type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
