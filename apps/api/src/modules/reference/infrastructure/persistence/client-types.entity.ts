import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'client_types' })
export class ClientTypeEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
