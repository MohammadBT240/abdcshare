import {
  Entity,
  Enum,
  ManyToOne,
  OptionalProps,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { SubmissionStatus } from '@abdcshare/shared';
import { DiscussionMessageEntity } from './discussion-message.entity';
import { SubmissionFileEntity } from '../../../submissions/infrastructure/persistence/submission-file.entity';

/**
 * A discussion message reference to a submission file.
 * Snapshots fileName + status at post time so the thread stays transparent
 * even if the live file status changes later.
 */
@Entity({ tableName: 'discussion_file_refs' })
export class DiscussionFileReferenceEntity {
  [OptionalProps]?: 'id';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => DiscussionMessageEntity, { deleteRule: 'cascade' })
  message!: DiscussionMessageEntity;

  /** Live file link (null if the file was later deleted). */
  @ManyToOne(() => SubmissionFileEntity, {
    nullable: true,
    deleteRule: 'set null',
  })
  submissionFile?: SubmissionFileEntity | null;

  /** Snapshot of the file name when the message was posted. */
  @Property()
  fileName!: string;

  /** Snapshot of the file review status when the message was posted. */
  @Enum({ items: () => SubmissionStatus })
  statusAtPost!: SubmissionStatus;

  /** Submission id for deep-links (denormalized). */
  @Property({ type: 'uuid', nullable: true })
  submissionId?: string | null;
}
