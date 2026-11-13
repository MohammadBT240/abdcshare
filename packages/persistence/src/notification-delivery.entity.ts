import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * The worker's narrow view of `notifications`: only the email-delivery columns it writes.
 * The API owns the full entity (with its user relation) and the schema; this class is never
 * registered in the API, so it doesn't take part in migrations.
 */
@Entity({ tableName: 'notifications' })
export class NotificationDeliveryEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'boolean' })
  emailSent!: boolean;

  @Property({ type: 'timestamptz', nullable: true })
  emailSentAt?: Date | null;
}
