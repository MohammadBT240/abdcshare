import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { RoleEntity } from '../../../roles/infrastructure/persistence/role.entity';
import { DepartmentEntity } from '../../../departments/infrastructure/persistence/department.entity';
import { ClientEntity } from '../../../clients/infrastructure/persistence/client.entity';

@Entity({ tableName: 'users' })
export class UserEntity extends BaseEntity {
  @ManyToOne(() => RoleEntity)
  role!: RoleEntity;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  department?: DepartmentEntity | null;

  // Set only for Client-role users.
  @ManyToOne(() => ClientEntity, { nullable: true })
  client?: ClientEntity | null;

  @Property()
  fullName!: string;

  @Property({ unique: true })
  @Index()
  email!: string;

  @Property({ hidden: true })
  passwordHash!: string;

  @Property({ nullable: true })
  avatarPath?: string | null;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ default: false })
  mustChangePassword: boolean = false;
}
