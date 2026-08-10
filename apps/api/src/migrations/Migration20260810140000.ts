import { Migration } from '@mikro-orm/migrations';

/**
 * Per-line amount received; remark replaces variance; outstanding computed total.
 * Officer title becomes optional (UI removed).
 */
export class Migration20260810140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "partner_report_billing_items"
        add column if not exists "amount_received" numeric(18,2) not null default 0;
    `);

    this.addSql(`
      do $$ begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'variance_vs_budget'
        ) and not exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'remark'
        ) then
          alter table "partner_reports" rename column "variance_vs_budget" to "remark";
        elsif not exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'remark'
        ) then
          alter table "partner_reports" add column "remark" varchar(255) null;
        end if;
      end $$;
    `);

    this.addSql(`
      do $$ begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'outstanding_wip'
        ) and not exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'outstanding'
        ) then
          alter table "partner_reports" rename column "outstanding_wip" to "outstanding";
        elsif not exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'outstanding'
        ) then
          alter table "partner_reports" add column "outstanding" numeric(18,2) null;
        end if;
      end $$;
    `);

    this.addSql(`
      alter table "partner_reports"
        alter column "officer_title" drop not null;
    `);

    // Recompute collections / outstanding from line amounts when lines exist.
    this.addSql(`
      update "partner_reports" r
      set
        "fee_revenue" = sub.fee_total,
        "collections_received" = sub.collections_total,
        "outstanding" = (sub.fee_total - sub.collections_total)
      from (
        select
          "report_id",
          sum("amount")::numeric(18,2) as fee_total,
          sum("amount_received")::numeric(18,2) as collections_total
        from "partner_report_billing_items"
        group by "report_id"
      ) sub
      where r."id" = sub."report_id";
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "partner_report_billing_items"
        drop column if exists "amount_received";
    `);
    this.addSql(`
      do $$ begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'remark'
        ) and not exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'variance_vs_budget'
        ) then
          alter table "partner_reports" rename column "remark" to "variance_vs_budget";
        end if;
      end $$;
    `);
    this.addSql(`
      do $$ begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'outstanding'
        ) and not exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'outstanding_wip'
        ) then
          alter table "partner_reports" rename column "outstanding" to "outstanding_wip";
        end if;
      end $$;
    `);
    this.addSql(`
      update "partner_reports" set "officer_title" = 'Partner' where "officer_title" is null;
    `);
    this.addSql(`
      alter table "partner_reports"
        alter column "officer_title" set not null;
    `);
  }
}
