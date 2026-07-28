import { Collection, Entity, Enum, ManyToOne, OneToMany, Property } from '@mikro-orm/core';
import {
  PartnerReportStatus,
  ReportCurrency,
  ReportingOfficerTitle,
  ReportPeriodType,
} from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { PartnerReportInviteEntity } from './partner-report-invite.entity';
import { PartnerReportEngagementUpdateEntity } from './partner-report-engagement-update.entity';
import { PartnerReportDecisionEntity } from './partner-report-decision.entity';

/** A structured periodic report to the Chairman (Principal Partner). */
@Entity({ tableName: 'partner_reports' })
export class PartnerReportEntity extends BaseEntity {
  @ManyToOne(() => UserEntity)
  submittedBy!: UserEntity;

  /** Set when the author is a Guest invited by the Principal Partner. */
  @ManyToOne(() => PartnerReportInviteEntity, { nullable: true })
  invite?: PartnerReportInviteEntity | null;

  // 01 — Reporting officer
  @Property()
  reportingOfficerName!: string;

  @Enum({ items: () => ReportingOfficerTitle })
  officerTitle!: ReportingOfficerTitle;

  @Property()
  department!: string;

  @Enum({ items: () => ReportPeriodType })
  periodType!: ReportPeriodType;

  @Property({ nullable: true })
  periodLabel?: string | null;

  // 02 — Executive summary
  @Property({ type: 'text', nullable: true })
  executiveSummary?: string | null;

  // 03 — Financial performance
  @Enum({ items: () => ReportCurrency, nullable: true })
  currency?: ReportCurrency | null;

  @Property({ columnType: 'numeric(18,2)', nullable: true })
  feeRevenue?: string | null;

  @Property({ columnType: 'numeric(18,2)', nullable: true })
  billingsRaised?: string | null;

  @Property({ columnType: 'numeric(18,2)', nullable: true })
  collectionsReceived?: string | null;

  @Property({ columnType: 'numeric(18,2)', nullable: true })
  outstandingWip?: string | null;

  @Property({ nullable: true })
  varianceVsBudget?: string | null;

  // 06 — People & capacity
  @Property({ type: 'text', nullable: true })
  peopleCapacity?: string | null;

  // 09 — Outlook, next period
  @Property({ type: 'text', nullable: true })
  outlook?: string | null;

  @Enum({ items: () => PartnerReportStatus })
  status: PartnerReportStatus = PartnerReportStatus.Draft;

  @Property({ type: 'timestamptz', nullable: true })
  submittedAt?: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  reviewedBy?: UserEntity | null;

  @Property({ type: 'text', nullable: true })
  reviewNotes?: string | null;

  @Property({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  // 04 — Client & engagement updates
  @OneToMany(() => PartnerReportEngagementUpdateEntity, (u) => u.report)
  engagementUpdates = new Collection<PartnerReportEngagementUpdateEntity>(this);

  // 08 — Matters requiring the Chairman's decision
  @OneToMany(() => PartnerReportDecisionEntity, (d) => d.report)
  decisions = new Collection<PartnerReportDecisionEntity>(this);
}
