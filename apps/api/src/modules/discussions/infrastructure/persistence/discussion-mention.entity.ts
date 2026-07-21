import { Entity, ManyToOne, PrimaryKeyProp } from '@mikro-orm/core';
import { DiscussionMessageEntity } from './discussion-message.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** A @mention of a user in a discussion message. */
@Entity({ tableName: 'discussion_mentions' })
export class DiscussionMentionEntity {
  @ManyToOne(() => DiscussionMessageEntity, { primary: true, deleteRule: 'cascade' })
  message!: DiscussionMessageEntity;

  @ManyToOne(() => UserEntity, { primary: true })
  mentionedUser!: UserEntity;

  [PrimaryKeyProp]?: ['message', 'mentionedUser'];
}
