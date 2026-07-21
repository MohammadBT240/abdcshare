import { Migration } from '@mikro-orm/migrations';

export class Migration20260721181257 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "discussion_messages" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "request_id" uuid not null, "author_id" uuid not null, "parent_message_id" uuid null, "body" text not null, "edited_at" timestamptz null, constraint "discussion_messages_pkey" primary key ("id"));`);

    this.addSql(`create table "discussion_reads" ("request_id" uuid not null, "user_id" uuid not null, "last_read_message_id" uuid null, "updated_at" timestamptz not null, constraint "discussion_reads_pkey" primary key ("request_id", "user_id"));`);

    this.addSql(`create table "discussion_mentions" ("message_id" uuid not null, "mentioned_user_id" uuid not null, constraint "discussion_mentions_pkey" primary key ("message_id", "mentioned_user_id"));`);

    this.addSql(`create table "discussion_attachments" ("id" uuid not null, "message_id" uuid not null, "storage_key" varchar(255) not null, "file_name" varchar(255) not null, "mime_type" varchar(255) null, "size_bytes" varchar(255) null, "uploaded_at" timestamptz not null, constraint "discussion_attachments_pkey" primary key ("id"));`);

    this.addSql(`create table "reviews" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "request_id" uuid null, "document_id" uuid null, "preparer_id" uuid not null, "reviewer_id" uuid null, "status" text check ("status" in ('ForReview', 'Approved', 'SentBack')) not null default 'ForReview', "notes" text null, "sent_from_id" uuid null, "submitted_at" timestamptz not null, "decided_at" timestamptz null, constraint "reviews_pkey" primary key ("id"));`);

    this.addSql(`alter table "discussion_messages" add constraint "discussion_messages_request_id_foreign" foreign key ("request_id") references "requests" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "discussion_messages" add constraint "discussion_messages_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "discussion_messages" add constraint "discussion_messages_parent_message_id_foreign" foreign key ("parent_message_id") references "discussion_messages" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "discussion_reads" add constraint "discussion_reads_request_id_foreign" foreign key ("request_id") references "requests" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "discussion_reads" add constraint "discussion_reads_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "discussion_reads" add constraint "discussion_reads_last_read_message_id_foreign" foreign key ("last_read_message_id") references "discussion_messages" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "discussion_mentions" add constraint "discussion_mentions_message_id_foreign" foreign key ("message_id") references "discussion_messages" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "discussion_mentions" add constraint "discussion_mentions_mentioned_user_id_foreign" foreign key ("mentioned_user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "discussion_attachments" add constraint "discussion_attachments_message_id_foreign" foreign key ("message_id") references "discussion_messages" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "reviews" add constraint "reviews_request_id_foreign" foreign key ("request_id") references "requests" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "reviews" add constraint "reviews_document_id_foreign" foreign key ("document_id") references "documents" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "reviews" add constraint "reviews_preparer_id_foreign" foreign key ("preparer_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "reviews" add constraint "reviews_reviewer_id_foreign" foreign key ("reviewer_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "reviews" add constraint "reviews_sent_from_id_foreign" foreign key ("sent_from_id") references "users" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "discussion_messages" drop constraint "discussion_messages_parent_message_id_foreign";`);

    this.addSql(`alter table "discussion_reads" drop constraint "discussion_reads_last_read_message_id_foreign";`);

    this.addSql(`alter table "discussion_mentions" drop constraint "discussion_mentions_message_id_foreign";`);

    this.addSql(`alter table "discussion_attachments" drop constraint "discussion_attachments_message_id_foreign";`);

    this.addSql(`drop table if exists "discussion_messages" cascade;`);

    this.addSql(`drop table if exists "discussion_reads" cascade;`);

    this.addSql(`drop table if exists "discussion_mentions" cascade;`);

    this.addSql(`drop table if exists "discussion_attachments" cascade;`);

    this.addSql(`drop table if exists "reviews" cascade;`);
  }

}
