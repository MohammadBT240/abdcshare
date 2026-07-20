import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'departments' })
export class DepartmentEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
