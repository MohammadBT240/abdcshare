import { Entity, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { EngagementEntity } from './engagement.entity';
import { RequestClassEntity } from '../../../request-classes/infrastructure/persistence/request-class.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** Which request classes are in scope for an engagement (requests group under these). */
@Entity({ tableName: 'engagement_request_classes' })
export class EngagementRequestClassEntity {
  [OptionalProps]?: 'sortOrder';

  @ManyToOne(() => EngagementEntity, { primary: true, deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @ManyToOne(() => RequestClassEntity, { primary: true })
  requestClass!: RequestClassEntity;

  @Property({ default: 0 })
  sortOrder: number = 0;

  @ManyToOne(() => UserEntity, { nullable: true })
  addedBy?: UserEntity | null;

  [PrimaryKeyProp]?: ['engagement', 'requestClass'];
}
