import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

@Entity({ tableName: 'company_profile' })
export class CompanyProfileEntity {
  @PrimaryKey()
  id: number = 1; // singleton row

  @Property()
  name!: string;

  @Property({ nullable: true })
  logoPath?: string | null;

  @Property({ nullable: true })
  email?: string | null;

  @Property({ nullable: true })
  phone?: string | null;

  @Property({ type: 'text', nullable: true })
  address?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  updatedBy?: UserEntity | null;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
