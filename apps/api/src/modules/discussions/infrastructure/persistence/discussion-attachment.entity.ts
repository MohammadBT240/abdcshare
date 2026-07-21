import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { DiscussionMessageEntity } from './discussion-message.entity';

/** A file attached to a discussion message (stored via the StoragePort). */
@Entity({ tableName: 'discussion_attachments' })
export class DiscussionAttachmentEntity {
  [OptionalProps]?: 'id' | 'uploadedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => DiscussionMessageEntity, { deleteRule: 'cascade' })
  message!: DiscussionMessageEntity;

  @Property()
  storageKey!: string;

  @Property()
  fileName!: string;

  @Property({ nullable: true })
  mimeType?: string | null;

  @Property({ nullable: true })
  sizeBytes?: number | null;

  @Property({ type: 'timestamptz' })
  uploadedAt: Date = new Date();
}
