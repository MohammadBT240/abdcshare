import { Migration } from '@mikro-orm/migrations';

export class Migration20260803110226 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "submission_files" add column "review_reason" text null, add column "reviewed_by_id" uuid null, add column "reviewed_at" timestamptz null, add column "replaces_file_id" uuid null;`);
    this.addSql(`alter table "submission_files" add constraint "submission_files_reviewed_by_id_foreign" foreign key ("reviewed_by_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "submission_files" add constraint "submission_files_replaces_file_id_foreign" foreign key ("replaces_file_id") references "submission_files" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "submission_files" drop constraint "submission_files_reviewed_by_id_foreign";`);
    this.addSql(`alter table "submission_files" drop constraint "submission_files_replaces_file_id_foreign";`);

    this.addSql(`alter table "submission_files" drop column "review_reason", drop column "reviewed_by_id", drop column "reviewed_at", drop column "replaces_file_id";`);
  }

}
