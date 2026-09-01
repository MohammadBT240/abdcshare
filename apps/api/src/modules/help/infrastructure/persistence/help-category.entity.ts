import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'help_categories' })
@Unique({ properties: ['slug'] })
export class HelpCategoryEntity {
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
}
