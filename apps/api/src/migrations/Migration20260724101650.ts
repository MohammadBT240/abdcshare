import { Migration } from '@mikro-orm/migrations';

export class Migration20260724101650 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "submission_files" ("id" uuid not null, "submission_id" uuid not null, "storage_key" varchar(255) not null, "file_name" varchar(255) not null, "mime_type" varchar(255) null, "size_bytes" varchar(255) null, "status" text check ("status" in ('Pending', 'Accepted', 'Returned')) not null default 'Pending', "uploaded_at" timestamptz not null, constraint "submission_files_pkey" primary key ("id"));`);

    this.addSql(`alter table "submission_files" add constraint "submission_files_submission_id_foreign" foreign key ("submission_id") references "client_submissions" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "submission_files" cascade;`);
  }

}
