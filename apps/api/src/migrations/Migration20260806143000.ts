import { Migration } from '@mikro-orm/migrations';

/** Discussion messages can reference submission files with status snapshot at post time. */
export class Migration20260806143000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "discussion_file_refs" (
        "id" uuid not null,
        "message_id" uuid not null,
        "submission_file_id" uuid null,
        "file_name" varchar(255) not null,
        "status_at_post" text check ("status_at_post" in ('Draft', 'Pending', 'UnderReview', 'Accepted', 'Returned')) not null,
        "submission_id" uuid null,
        constraint "discussion_file_refs_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "discussion_file_refs" add constraint "discussion_file_refs_message_id_foreign" foreign key ("message_id") references "discussion_messages" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "discussion_file_refs" add constraint "discussion_file_refs_submission_file_id_foreign" foreign key ("submission_file_id") references "submission_files" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `create index "discussion_file_refs_message_id_index" on "discussion_file_refs" ("message_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "discussion_file_refs" cascade;`);
  }
}
