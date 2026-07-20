import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

@Entity({ tableName: 'refresh_tokens' })
export class RefreshTokenEntity extends BaseEntity {
  @ManyToOne(() => UserEntity)
  user!: UserEntity;

  @Property({ unique: true })
  @Index()
  tokenHash!: string;

  // Rotation family — on reuse detection, revoke the whole family.
  @Property({ type: 'uuid' })
  familyId!: string;

  @Property({ nullable: true })
  userAgent?: string | null;

  @Property({ nullable: true })
  ipAddress?: string | null;

  @Property({ type: 'timestamptz' })
  expiresAt!: Date;

  @Property({ type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;
}
