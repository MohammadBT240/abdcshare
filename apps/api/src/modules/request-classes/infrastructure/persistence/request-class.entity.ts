import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'request_classes' })
export class RequestClassEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true, nullable: true })
  code?: string | null;

  @Property({ unique: true })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @Property({ default: true })
  isActive: boolean = true;
}
