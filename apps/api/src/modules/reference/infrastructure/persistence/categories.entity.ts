import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'categories' })
export class CategoryEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
