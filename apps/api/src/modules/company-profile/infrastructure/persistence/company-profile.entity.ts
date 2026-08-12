import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** Staff reference document in the company profiles library. */
@Entity({ tableName: 'company_profiles' })
export class CompanyProfileEntity {
  [OptionalProps]?: 'id' | 'isActive' | 'createdAt' | 'updatedAt' | 'storageKey' | 'fileName';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property()
  name!: string;

  /** Null until Uppy confirm (draft row). */
  @Property({ nullable: true })
  storageKey?: string | null;

  @Property({ nullable: true })
  fileName?: string | null;

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
