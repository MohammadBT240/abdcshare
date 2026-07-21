import { Collection, Entity, Enum, ManyToOne, OneToMany, Property } from '@mikro-orm/core';
import { DocumentCategory, DocumentStatus, ReportReviewState } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { EngagementEntity } from '../../../engagements/infrastructure/persistence/engagement.entity';
import { RequestClassEntity } from '../../../request-classes/infrastructure/persistence/request-class.entity';
import { RequestEntity } from '../../../requests/infrastructure/persistence/request.entity';
import { DepartmentEntity } from '../../../departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { DocumentFileEntity } from './document-file.entity';
import { DocumentParticipantEntity } from './document-participant.entity';

/** A working paper or final report — the logical document (files are versioned). */
@Entity({ tableName: 'documents' })
export class DocumentEntity extends BaseEntity {
  @ManyToOne(() => EngagementEntity, { deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @ManyToOne(() => RequestClassEntity)
  requestClass!: RequestClassEntity;

  @ManyToOne(() => RequestEntity, { nullable: true })
  request?: RequestEntity | null;

  @ManyToOne(() => DepartmentEntity)
  department!: DepartmentEntity;

  @Enum({ items: () => DocumentCategory })
  category!: DocumentCategory;

  @Property()
  title!: string;

  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @Enum({ items: () => DocumentStatus })
  status: DocumentStatus = DocumentStatus.Draft;

  @Property({ default: 0 })
  currentVersion: number = 0;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  /** Final-report client-review loop (NotSent for working papers). */
  @Enum({ items: () => ReportReviewState })
  clientReviewState: ReportReviewState = ReportReviewState.NotSent;

  /** How many times the final report has been sent to the client (0–3). */
  @Property({ default: 0 })
  clientReviewRound: number = 0;

  @OneToMany(() => DocumentFileEntity, (f) => f.document)
  files = new Collection<DocumentFileEntity>(this);

  @OneToMany(() => DocumentParticipantEntity, (p) => p.document)
  participants = new Collection<DocumentParticipantEntity>(this);
}
