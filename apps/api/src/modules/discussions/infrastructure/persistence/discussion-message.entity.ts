import { Collection, Entity, ManyToOne, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { RequestEntity } from '../../../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { DiscussionAttachmentEntity } from './discussion-attachment.entity';
import { DiscussionMentionEntity } from './discussion-mention.entity';

/** A message in a request's discussion thread. */
@Entity({ tableName: 'discussion_messages' })
export class DiscussionMessageEntity extends BaseEntity {
  @ManyToOne(() => RequestEntity, { deleteRule: 'cascade' })
  request!: RequestEntity;

  @ManyToOne(() => UserEntity)
  author!: UserEntity;

  @ManyToOne(() => DiscussionMessageEntity, { nullable: true })
  parentMessage?: DiscussionMessageEntity | null;

  @Property({ type: 'text' })
  body!: string;

  @Property({ type: 'timestamptz', nullable: true })
  editedAt?: Date | null;

  @OneToMany(() => DiscussionMentionEntity, (m) => m.message)
  mentions = new Collection<DiscussionMentionEntity>(this);

  @OneToMany(() => DiscussionAttachmentEntity, (a) => a.message)
  attachments = new Collection<DiscussionAttachmentEntity>(this);
}
