import { Entity, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'help_categories' })
@Unique({ properties: ['slug'] })
export class HelpCategoryEntity {
  [OptionalProps]?: 'order' | 'source';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property()
  name!: string;

  @Property()
  slug!: string;

  @Property({ default: 0 })
  order: number = 0;

  @Property({ nullable: true })
  icon?: string | null;

  /** Shown on the Help Center landing card. */
  @Property({ type: 'text', nullable: true })
  description?: string | null;

  /** `default` categories come from docs/help/<slug>/_category.md. */
  @Property({ type: 'text', default: 'custom' })
  source: 'default' | 'custom' = 'custom';
}
