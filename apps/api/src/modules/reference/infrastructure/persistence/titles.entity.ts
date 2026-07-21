import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'titles' })
export class TitleEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
