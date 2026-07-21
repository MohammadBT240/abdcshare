import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'genders' })
export class GenderEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
