import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { ReportDecisionPriority } from '@abdcshare/shared';
import { PartnerReportEntity } from './partner-report.entity';

/** 08 — a "matter requiring the Chairman's decision" row within a partner report. */
@Entity({ tableName: 'partner_report_decisions' })
export class PartnerReportDecisionEntity {
  [OptionalProps]?: 'id' | 'sortOrder';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => PartnerReportEntity, { deleteRule: 'cascade' })
  report!: PartnerReportEntity;

  @Property({ type: 'text' })
  decision!: string;

  @Enum({ items: () => ReportDecisionPriority })
  priority!: ReportDecisionPriority;

  @Property({ default: 0 })
  sortOrder: number = 0;
}
