import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

@Entity({ tableName: 'password_reset_tokens' })
export class PasswordResetTokenEntity extends BaseEntity {
  @ManyToOne(() => UserEntity)
  user!: UserEntity;

  @Property({ unique: true })
  tokenHash!: string;

  @Property({ type: 'timestamptz' })
  expiresAt!: Date;

  @Property({ type: 'timestamptz', nullable: true })
  usedAt?: Date | null;
}
