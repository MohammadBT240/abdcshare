import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** Staff reference document in the company profiles library. */
@Entity({ tableName: 'company_profiles' })
export class CompanyProfileEntity {
  [OptionalProps]?: 'id' | 'isActive' | 'createdAt' | 'updatedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property()
  name!: string;

  @Property()
  storageKey!: string;

  @Property()
  fileName!: string;

  @Property({ nullable: true })
  mimeType?: string | null;

  @Property({ type: 'integer', nullable: true })
  sizeBytes?: number | null;

  @Property({ default: true })
  isActive: boolean = true;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
