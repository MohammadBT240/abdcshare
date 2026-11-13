import { Entity, Enum, Index, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { LibraryEventAction } from '@abdcshare/shared';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { LibraryItemEntity } from './library-item.entity';
import { LibraryCollectionEntity } from './library-collection.entity';

/**
 * Append-only library activity log (S2, D15/D16). Never updated except to snapshot an item's
 * title into `metadata` just before the item is deleted (its `item_id` then becomes null).
 * Mutations are written in the same flush as the change; views and downloads are inserted
 * directly once the URL has been presigned.
 */
@Entity({ tableName: 'library_events' })
@Index({
  name: 'library_events_item_created_idx',
  expression: 'create index "library_events_item_created_idx" on "library_events" ("item_id", "created_at" desc)',
})
@Index({
  name: 'library_events_actor_created_idx',
  expression: 'create index "library_events_actor_created_idx" on "library_events" ("actor_id", "created_at" desc)',
})
@Index({
  name: 'library_events_action_created_idx',
  expression: 'create index "library_events_action_created_idx" on "library_events" ("action", "created_at" desc)',
})
@Index({ name: 'library_events_collection_idx', properties: ['collection'] })
export class LibraryEventEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'metadata' | 'ip' | 'userAgent' | 'item' | 'collection' | 'actor';

  /** bigserial — read events are high-volume. Mapped to string (bigint). */
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => LibraryItemEntity, { nullable: true, deleteRule: 'set null', index: false })
  item?: LibraryItemEntity | null;

  @ManyToOne(() => LibraryCollectionEntity, { nullable: true, deleteRule: 'set null', index: false })
  collection?: LibraryCollectionEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, deleteRule: 'set null', index: false })
  actor?: UserEntity | null;

  @Enum({ items: () => LibraryEventAction })
  action!: LibraryEventAction;

  @Property({ length: 64, nullable: true })
  ip?: string | null;

  @Property({ length: 300, nullable: true })
  userAgent?: string | null;

  @Property({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
