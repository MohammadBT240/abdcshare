import { Collection, Entity, Enum, ManyToOne, OneToMany, Property } from '@mikro-orm/core';
import { EngagementPhase } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { EngagementEntity } from '../../../engagements/infrastructure/persistence/engagement.entity';
import { RequestTypeEntity } from '../../../request-types/infrastructure/persistence/request-type.entity';
import { RequestStageEntity } from '../../../request-stages/infrastructure/persistence/request-stage.entity';
import { RequestStatusEntity } from '../../../request-statuses/infrastructure/persistence/request-status.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { RequestAssigneeEntity } from './request-assignee.entity';

/**
 * A work item under an engagement. Its request class is DERIVED from the request type
 * (`requestType.requestClass`) and must be in the engagement's scope (engagement_request_classes).
 */
@Entity({ tableName: 'requests' })
export class RequestEntity extends BaseEntity {
  @ManyToOne(() => EngagementEntity, { deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @ManyToOne(() => RequestTypeEntity)
  requestType!: RequestTypeEntity;

  @ManyToOne(() => RequestStageEntity, { nullable: true })
  stage?: RequestStageEntity | null;

  @ManyToOne(() => RequestStatusEntity, { nullable: true })
  status?: RequestStatusEntity | null;

  /** Engagement stage this request belongs to (Planning/Execution/Reporting). */
  @Enum({ items: () => EngagementPhase, nullable: true })
  phase?: EngagementPhase | null;

  @Property({ type: 'text' })
  description!: string;

  @Property({ type: 'date', nullable: true })
  dueDate?: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  @OneToMany(() => RequestAssigneeEntity, (a) => a.request)
  assignees = new Collection<RequestAssigneeEntity>(this);
}
