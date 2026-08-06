import { Migration } from '@mikro-orm/migrations';

/** Office→PDF preview fields for request expectation briefs. */
export class Migration20260806150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "requests" add column "brief_preview_storage_key" varchar(255) null;`,
    );
    this.addSql(
      `alter table "requests" add column "brief_preview_status" text check ("brief_preview_status" in ('None', 'Pending', 'Ready', 'Failed')) not null default 'None';`,
    );
    this.addSql(
      `alter table "requests" add column "brief_preview_error" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "requests" drop column "brief_preview_error";`);
    this.addSql(`alter table "requests" drop column "brief_preview_status";`);
    this.addSql(`alter table "requests" drop column "brief_preview_storage_key";`);
  }
}
