import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'states' })
export class StateEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
