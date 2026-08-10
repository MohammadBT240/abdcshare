import { Migration } from '@mikro-orm/migrations';

/**
 * Soft cadence / request fields on partner report roster.
 * Idempotent: local DBs may already have these columns from schema sync.
 */
export class Migration20260807140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "partner_report_reporters"
        add column if not exists "cadence" text not null default 'Weekly',
        add column if not exists "reminders_enabled" boolean not null default true,
        add column if not exists "report_requested_at" timestamptz null,
        add column if not exists "request_note" text null,
        add column if not exists "last_reminded_at" timestamptz null;
    `);
    // Ensure cadence check constraint exists (skip if already present).
    this.addSql(`
      do $$ begin
        alter table "partner_report_reporters"
          add constraint "partner_report_reporters_cadence_check"
          check ("cadence" in ('Weekly', 'Monthly', 'Quarterly', 'None'));
      exception
        when duplicate_object then null;
      end $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "partner_report_reporters"
        drop constraint if exists "partner_report_reporters_cadence_check";
    `);
    this.addSql(`
      alter table "partner_report_reporters"
        drop column if exists "cadence",
        drop column if exists "reminders_enabled",
        drop column if exists "report_requested_at",
        drop column if exists "request_note",
        drop column if exists "last_reminded_at";
    `);
  }
}
