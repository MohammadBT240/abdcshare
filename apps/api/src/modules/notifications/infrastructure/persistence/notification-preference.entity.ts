import { Entity, ManyToOne, OptionalProps, PrimaryKey, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** Per-user, per-type delivery preferences (email / in-app). */
@Entity({ tableName: 'notification_preferences' })
export class NotificationPreferenceEntity {
  [OptionalProps]?: 'emailEnabled' | 'inAppEnabled';

  @ManyToOne(() => UserEntity, { primary: true, deleteRule: 'cascade' })
  user!: UserEntity;

  @PrimaryKey()
  notificationType!: string;

  @Property({ default: true })
  emailEnabled: boolean = true;

  @Property({ default: true })
  inAppEnabled: boolean = true;

  [PrimaryKeyProp]?: ['user', 'notificationType'];
}
