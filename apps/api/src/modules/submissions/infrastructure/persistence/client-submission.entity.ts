import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { SubmissionStatus } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { RequestEntity } from '../../../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** A client's response to a request (legacy `client_response`). */
@Entity({ tableName: 'client_submissions' })
export class ClientSubmissionEntity extends BaseEntity {
  @ManyToOne(() => RequestEntity, { deleteRule: 'cascade' })
  request!: RequestEntity;

  @ManyToOne(() => UserEntity)
  submittedBy!: UserEntity;

  @Property({ type: 'text' })
  message!: string;

  @Enum({ items: () => SubmissionStatus })
  status: SubmissionStatus = SubmissionStatus.Pending;

  @ManyToOne(() => UserEntity, { nullable: true })
  reviewedBy?: UserEntity | null;

  @Property({ type: 'text', nullable: true })
  reviewReason?: string | null;

  @Property({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;
}
