import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Images shipped with the default help articles, keyed by content hash so a re-sync never
 * uploads the same screenshot twice (storage keys carry a random UUID).
 */
@Entity({ tableName: 'help_assets' })
export class HelpAssetEntity {
  @PrimaryKey({ length: 64 })
  hash!: string;

  @Property({ type: 'text' })
  storageKey!: string;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();
}
