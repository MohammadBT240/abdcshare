import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** An in-app notification for a user (email delivery tracked separately). */
@Entity({ tableName: 'notifications' })
export class NotificationEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, { deleteRule: 'cascade' })
  user!: UserEntity;

  @Property()
  type!: string;

  @Property()
  title!: string;

  @Property({ type: 'text', nullable: true })
  body?: string | null;

  /** What the notification is about, e.g. `request` / `document` + its id. */
  @Property({ nullable: true })
  entityType?: string | null;

  @Property({ nullable: true })
  entityId?: string | null;

  @Property({ type: 'text', nullable: true })
  link?: string | null;

  @Property({ default: false })
  isRead: boolean = false;

  @Property({ type: 'timestamptz', nullable: true })
  readAt?: Date | null;

  @Property({ default: false })
  emailSent: boolean = false;

  @Property({ type: 'timestamptz', nullable: true })
  emailSentAt?: Date | null;
}
