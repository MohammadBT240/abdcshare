import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { RequestEntity } from './request.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** Append-only audit trail for a request (legacy `requesthistory`). */
@Entity({ tableName: 'request_history' })
export class RequestHistoryEntity {
  [OptionalProps]?: 'id' | 'createdAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => RequestEntity, { deleteRule: 'cascade' })
  request!: RequestEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  actor?: UserEntity | null;

  @Property()
  eventType!: string;

  @Property({ default: 'requests' })
  module: string = 'requests';

  @Property({ type: 'text', nullable: true })
  fromValue?: string | null;

  @Property({ type: 'text', nullable: true })
  toValue?: string | null;

  @Property({ type: 'text', nullable: true })
  note?: string | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();
}
