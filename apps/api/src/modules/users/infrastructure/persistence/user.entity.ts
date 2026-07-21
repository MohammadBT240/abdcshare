import { Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/core';
import type { PartnerDesignation } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { RoleEntity } from '../../../roles/infrastructure/persistence/role.entity';
import { DepartmentEntity } from '../../../departments/infrastructure/persistence/department.entity';
import { ClientEntity } from '../../../clients/infrastructure/persistence/client.entity';
import { TitleEntity } from '../../../reference/infrastructure/persistence/titles.entity';
import { GenderEntity } from '../../../reference/infrastructure/persistence/genders.entity';
import { MaritalStatusEntity } from '../../../reference/infrastructure/persistence/marital-statuses.entity';

@Entity({ tableName: 'users' })
export class UserEntity extends BaseEntity {
  @ManyToOne(() => RoleEntity)
  role!: RoleEntity;

  // Super-Admin sub-flag; at most one PrincipalPartner (partial unique index in the migration).
  @Enum({ items: () => ['PrincipalPartner', 'Partner'], nullable: true })
  partnerDesignation?: PartnerDesignation | null;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  department?: DepartmentEntity | null;

  // Set only for Client-role users.
  @ManyToOne(() => ClientEntity, { nullable: true })
  client?: ClientEntity | null;

  // ---- profile (full parity with legacy users_details) ----
  @ManyToOne(() => TitleEntity, { nullable: true })
  title?: TitleEntity | null;

  @Property()
  firstName!: string;

  @Property({ nullable: true })
  middleName?: string | null;

  @Property()
  surname!: string;

  /** Cached display name (firstName [middleName] surname); kept for convenience + legacy compatibility. */
  @Property()
  fullName!: string;

  @ManyToOne(() => GenderEntity, { nullable: true })
  gender?: GenderEntity | null;

  @ManyToOne(() => MaritalStatusEntity, { nullable: true })
  maritalStatus?: MaritalStatusEntity | null;

  @Property({ unique: true })
  @Index()
  email!: string;

  @Property({ nullable: true })
  phoneNumber?: string | null;

  @Property({ nullable: true })
  officialAddress?: string | null;

  @Property({ nullable: true })
  residentialAddress?: string | null;

  @Property({ hidden: true })
  passwordHash!: string;

  @Property({ nullable: true })
  avatarPath?: string | null;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ default: false })
  mustChangePassword: boolean = false;
}
