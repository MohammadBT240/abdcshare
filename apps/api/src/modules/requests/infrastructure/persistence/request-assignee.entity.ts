import { Entity, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { RequestEntity } from './request.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** People assigned to a request (legacy `assigned_auditors`). */
@Entity({ tableName: 'request_assignees' })
export class RequestAssigneeEntity {
  [OptionalProps]?: 'assignedAt';

  @ManyToOne(() => RequestEntity, { primary: true, deleteRule: 'cascade' })
  request!: RequestEntity;

  @ManyToOne(() => UserEntity, { primary: true })
  user!: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  assignedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  assignedAt: Date = new Date();

  [PrimaryKeyProp]?: ['request', 'user'];
}
