import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'general_statuses' })
export class GeneralStatusEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
