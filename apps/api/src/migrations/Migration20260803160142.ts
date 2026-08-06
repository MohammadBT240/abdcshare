import { Migration } from '@mikro-orm/migrations';

export class Migration20260803160142 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "submission_files" add column "preview_storage_key" varchar(255) null, add column "preview_status" text check ("preview_status" in ('None', 'Pending', 'Ready', 'Failed')) not null default 'None', add column "preview_error" text null;`);

    this.addSql(`alter table "document_files" add column "preview_storage_key" varchar(255) null, add column "preview_status" text check ("preview_status" in ('None', 'Pending', 'Ready', 'Failed')) not null default 'None', add column "preview_error" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "document_files" drop column "preview_storage_key", drop column "preview_status", drop column "preview_error";`);

    this.addSql(`alter table "submission_files" drop column "preview_storage_key", drop column "preview_status", drop column "preview_error";`);
  }

}
