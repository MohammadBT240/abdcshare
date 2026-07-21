import { Entity, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { RequestEntity } from '../../../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { DiscussionMessageEntity } from './discussion-message.entity';

/** Read-tracking: how far a user has read a request's thread. */
@Entity({ tableName: 'discussion_reads' })
export class DiscussionReadEntity {
  [OptionalProps]?: 'updatedAt';

  @ManyToOne(() => RequestEntity, { primary: true, deleteRule: 'cascade' })
  request!: RequestEntity;

  @ManyToOne(() => UserEntity, { primary: true })
  user!: UserEntity;

  @ManyToOne(() => DiscussionMessageEntity, { nullable: true })
  lastReadMessage?: DiscussionMessageEntity | null;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  [PrimaryKeyProp]?: ['request', 'user'];
}
