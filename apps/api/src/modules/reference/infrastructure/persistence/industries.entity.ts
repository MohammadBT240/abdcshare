import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'industries' })
export class IndustryEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
