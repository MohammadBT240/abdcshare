import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { ReportReviewDecision } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { DocumentEntity } from '../../../documents/infrastructure/persistence/document.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** One client-review round of a final-report draft. */
@Entity({ tableName: 'report_review_cycles' })
export class ReportReviewCycleEntity extends BaseEntity {
  @ManyToOne(() => DocumentEntity, { deleteRule: 'cascade' })
  document!: DocumentEntity;

  @Property()
  roundNo!: number;

  /** The document file version the client reviewed in this round. */
  @Property()
  fileVersion!: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  sentBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  sentAt: Date = new Date();

  @Enum({ items: () => ReportReviewDecision })
  decision: ReportReviewDecision = ReportReviewDecision.Pending;

  @ManyToOne(() => UserEntity, { nullable: true })
  decidedBy?: UserEntity | null;

  @Property({ type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;

  @Property({ type: 'text', nullable: true })
  feedback?: string | null;
}
