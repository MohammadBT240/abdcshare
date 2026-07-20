import { Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import type { RoleName } from '@abdcshare/shared';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

@Entity({ tableName: 'roles' })
export class RoleEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  roleName!: RoleName;

  @OneToMany(() => UserEntity, (u) => u.role)
  users = new Collection<UserEntity>(this);
}
