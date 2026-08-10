import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { PartnerReportCadence } from '@abdcshare/shared';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/**
 * Roster membership for Chairman reporting.
 * Staff / Partners / Guests who may submit; cadence + reminders are soft preferences.
 */
@Entity({ tableName: 'partner_report_reporters' })
export class PartnerReportReporterEntity {
  [OptionalProps]?: 'createdAt' | 'cadence' | 'remindersEnabled' | 'financialsEnabled';

  @ManyToOne(() => UserEntity, { primary: true, deleteRule: 'cascade' })
  user!: UserEntity;

  @ManyToOne(() => UserEntity)
  allowedBy!: UserEntity;

  @Enum({ items: () => PartnerReportCadence })
  cadence: PartnerReportCadence = PartnerReportCadence.Weekly;

  @Property({ default: true })
  remindersEnabled: boolean = true;

  /** When false, the reporter's form omits the Financials step. */
  @Property({ default: true })
  financialsEnabled: boolean = true;

  /** Soft ask from the Principal — cleared when the reporter next submits. */
  @Property({ type: 'timestamptz', nullable: true })
  reportRequestedAt?: Date | null;

  @Property({ type: 'text', nullable: true })
  requestNote?: string | null;

  @Property({ type: 'timestamptz', nullable: true })
  lastRemindedAt?: Date | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  [PrimaryKeyProp]?: 'user';
}
