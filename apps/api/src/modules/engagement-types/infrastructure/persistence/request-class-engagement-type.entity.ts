import { Entity, ManyToOne, PrimaryKeyProp } from '@mikro-orm/core';
import { RequestClassEntity } from '../../../request-classes/infrastructure/persistence/request-class.entity';
import { EngagementTypeEntity } from './engagement-type.entity';

// Suggested request classes per engagement type (soft defaults on create; not a hard bind).
@Entity({ tableName: 'request_class_engagement_types' })
export class RequestClassEngagementTypeEntity {
  @ManyToOne(() => RequestClassEntity, { primary: true })
  requestClass!: RequestClassEntity;

  @ManyToOne(() => EngagementTypeEntity, { primary: true })
  engagementType!: EngagementTypeEntity;

  [PrimaryKeyProp]?: ['requestClass', 'engagementType'];
}
