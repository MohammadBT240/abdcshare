import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';

/** Admin-maintained grouping for library items (Reports, Research Papers, ...). */
@Entity({ tableName: 'library_categories' })
export class LibraryCategoryEntity extends BaseEntity {
  @Property({ unique: true })
  name!: string;

  @Property({ unique: true })
  slug!: string;

  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @Property({ default: 0 })
  sortOrder: number = 0;

  @Property({ default: true })
  isActive: boolean = true;
}
