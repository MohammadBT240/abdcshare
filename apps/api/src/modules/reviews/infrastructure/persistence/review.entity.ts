import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { ReviewStatus } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { RequestEntity } from '../../../requests/infrastructure/persistence/request.entity';
import { DocumentEntity } from '../../../documents/infrastructure/persistence/document.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** A review of a request or a document (legacy `reviews`). */
@Entity({ tableName: 'reviews' })
export class ReviewEntity extends BaseEntity {
  @ManyToOne(() => RequestEntity, { nullable: true, deleteRule: 'cascade' })
  request?: RequestEntity | null;

  @ManyToOne(() => DocumentEntity, { nullable: true, deleteRule: 'cascade' })
  document?: DocumentEntity | null;

  @ManyToOne(() => UserEntity)
  preparer!: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  reviewer?: UserEntity | null;

  @Enum({ items: () => ReviewStatus })
  status: ReviewStatus = ReviewStatus.ForReview;

  @Property({ type: 'text', nullable: true })
  notes?: string | null;

  /** Who sent it back (legacy sent_from), set on a SentBack decision. */
  @ManyToOne(() => UserEntity, { nullable: true })
  sentFrom?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  submittedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;
}
