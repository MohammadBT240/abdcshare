import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { PartnerReportEntity } from './partner-report.entity';

/** A billings line item: bill amount + amount received (balance = amount − received). */
@Entity({ tableName: 'partner_report_billing_items' })
export class PartnerReportBillingItemEntity {
  [OptionalProps]?: 'id' | 'sortOrder' | 'amountReceived';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => PartnerReportEntity, { deleteRule: 'cascade' })
  report!: PartnerReportEntity;

  @Property()
  description!: string;

  /** Bill amount for this line. */
  @Property({ columnType: 'numeric(18,2)' })
  amount!: string;

  /** Portion of the bill amount already collected. */
  @Property({ columnType: 'numeric(18,2)', default: '0' })
  amountReceived: string = '0';

  @Property({ default: 0 })
  sortOrder: number = 0;
}
