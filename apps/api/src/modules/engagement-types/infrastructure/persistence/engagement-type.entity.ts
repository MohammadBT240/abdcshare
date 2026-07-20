import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'engagement_types' })
export class EngagementTypeEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
