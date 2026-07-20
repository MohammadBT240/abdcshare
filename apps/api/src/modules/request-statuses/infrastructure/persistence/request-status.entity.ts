import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'request_statuses' })
export class RequestStatusEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ default: 0 })
  sortOrder: number = 0;

  @Property({ default: true })
  isActive: boolean = true;
}
