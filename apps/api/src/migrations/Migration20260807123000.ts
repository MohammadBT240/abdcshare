import { Migration } from '@mikro-orm/migrations';

/** Staff allow-list for Principal Partner reports. */
export class Migration20260807123000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "partner_report_reporters" (
        "user_id" uuid not null,
        "allowed_by_id" uuid not null,
        "created_at" timestamptz not null default now(),
        constraint "partner_report_reporters_pkey" primary key ("user_id")
      );
    `);
    this.addSql(
      `alter table "partner_report_reporters" add constraint "partner_report_reporters_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "partner_report_reporters" add constraint "partner_report_reporters_allowed_by_id_foreign" foreign key ("allowed_by_id") references "users" ("id") on update cascade on delete no action;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "partner_report_reporters" cascade;`);
  }
}
