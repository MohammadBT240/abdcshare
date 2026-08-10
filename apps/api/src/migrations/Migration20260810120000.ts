import { Migration } from '@mikro-orm/migrations';

/**
 * Report billings as line items; fee revenue = sum.
 * Per-reporter financialsEnabled flag on the roster.
 */
export class Migration20260810120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "partner_report_billing_items" (
        "id" uuid not null,
        "report_id" uuid not null,
        "description" varchar(255) not null,
        "amount" numeric(18,2) not null,
        "sort_order" int not null default 0,
        constraint "partner_report_billing_items_pkey" primary key ("id")
      );
    `);
    this.addSql(`
      do $$ begin
        alter table "partner_report_billing_items"
          add constraint "partner_report_billing_items_report_id_foreign"
          foreign key ("report_id") references "partner_reports" ("id")
          on update cascade on delete cascade;
      exception
        when duplicate_object then null;
      end $$;
    `);
    this.addSql(`
      create index if not exists "partner_report_billing_items_report_id_index"
        on "partner_report_billing_items" ("report_id");
    `);

    // Backfill only while the legacy column still exists.
    this.addSql(`
      do $$ begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'partner_reports' and column_name = 'billings_raised'
        ) then
          insert into "partner_report_billing_items" ("id", "report_id", "description", "amount", "sort_order")
          select gen_random_uuid(), "id", 'Billings raised', "billings_raised", 0
          from "partner_reports"
          where "billings_raised" is not null
            and not exists (
              select 1 from "partner_report_billing_items" b where b."report_id" = "partner_reports"."id"
            );
        end if;
      end $$;
    `);

    this.addSql(`
      update "partner_reports" r
      set "fee_revenue" = sub.total
      from (
        select "report_id", sum("amount")::numeric(18,2) as total
        from "partner_report_billing_items"
        group by "report_id"
      ) sub
      where r."id" = sub."report_id";
    `);

    this.addSql(`
      alter table "partner_reports" drop column if exists "billings_raised";
    `);

    this.addSql(`
      alter table "partner_report_reporters"
        add column if not exists "financials_enabled" boolean not null default true;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "partner_reports"
        add column if not exists "billings_raised" numeric(18,2) null;
    `);
    this.addSql(`
      update "partner_reports" r
      set "billings_raised" = sub.total
      from (
        select "report_id", sum("amount")::numeric(18,2) as total
        from "partner_report_billing_items"
        group by "report_id"
      ) sub
      where r."id" = sub."report_id";
    `);
    this.addSql(`drop table if exists "partner_report_billing_items" cascade;`);
    this.addSql(`
      alter table "partner_report_reporters"
        drop column if exists "financials_enabled";
    `);
  }
}
