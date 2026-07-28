import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { ReportUpdateStatus } from '@abdcshare/shared';
import { PartnerReportEntity } from './partner-report.entity';

/** 04 — a client/engagement update row within a partner report. */
@Entity({ tableName: 'partner_report_engagement_updates' })
export class PartnerReportEngagementUpdateEntity {
  [OptionalProps]?: 'id' | 'sortOrder';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => PartnerReportEntity, { deleteRule: 'cascade' })
  report!: PartnerReportEntity;

  @Property()
  clientEngagement!: string;

  @Property({ type: 'text' })
  update!: string;

  @Enum({ items: () => ReportUpdateStatus })
  status!: ReportUpdateStatus;

  @Property({ default: 0 })
  sortOrder: number = 0;
}
