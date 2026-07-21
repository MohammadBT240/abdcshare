import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'banks' })
export class BankEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
