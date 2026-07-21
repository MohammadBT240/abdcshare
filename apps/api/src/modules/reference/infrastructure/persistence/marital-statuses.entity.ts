import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'marital_statuses' })
export class MaritalStatusEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
