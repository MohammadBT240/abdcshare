import { Entity, Index, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { LibraryCollectionEntity } from './library-collection.entity';
import { LibraryItemEntity } from './library-item.entity';

/** Membership of an item in a collection, with its order and optional section label (D12). */
@Entity({ tableName: 'library_collection_items' })
@Index({ name: 'library_collection_items_position_idx', properties: ['collection', 'position'] })
export class LibraryCollectionItemEntity {
  [OptionalProps]?: 'position' | 'addedAt';

  @ManyToOne(() => LibraryCollectionEntity, { primary: true, deleteRule: 'cascade' })
  collection!: LibraryCollectionEntity;

  @ManyToOne(() => LibraryItemEntity, { primary: true, deleteRule: 'cascade' })
  @Index({ name: 'library_collection_items_item_idx' })
  item!: LibraryItemEntity;

  @Property({ default: 0 })
  position: number = 0;

  @Property({ length: 80, nullable: true })
  section?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, deleteRule: 'set null' })
  addedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  addedAt: Date = new Date();

  [PrimaryKeyProp]?: ['collection', 'item'];
}
