import { Migration } from '@mikro-orm/migrations';

export class Migration20260721172716 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "documents" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "engagement_id" uuid not null, "fs_line_id" int not null, "request_id" uuid null, "department_id" int not null, "category" text check ("category" in ('WorkingPaper', 'FinalReport')) not null, "title" varchar(255) not null, "description" text null, "status" text check ("status" in ('Draft', 'Ready', 'UnderReview', 'SignedOff')) not null default 'Draft', "current_version" int not null default 0, "created_by_id" uuid null, constraint "documents_pkey" primary key ("id"));`);

    this.addSql(`create table "document_participants" ("document_id" uuid not null, "user_id" uuid not null, "participant_role" text check ("participant_role" in ('Auditor', 'Advisor', 'Staff')) not null, "added_by_id" uuid null, "added_at" timestamptz not null, constraint "document_participants_pkey" primary key ("document_id", "user_id"));`);

    this.addSql(`create table "document_files" ("id" uuid not null, "document_id" uuid not null, "version" int not null, "storage_key" varchar(255) not null, "file_name" varchar(255) not null, "mime_type" varchar(255) null, "size_bytes" varchar(255) null, "uploaded_by_id" uuid null, "uploaded_at" timestamptz not null, constraint "document_files_pkey" primary key ("id"));`);

    this.addSql(`alter table "documents" add constraint "documents_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "documents" add constraint "documents_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade;`);
    this.addSql(`alter table "documents" add constraint "documents_request_id_foreign" foreign key ("request_id") references "requests" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "documents" add constraint "documents_department_id_foreign" foreign key ("department_id") references "departments" ("id") on update cascade;`);
    this.addSql(`alter table "documents" add constraint "documents_created_by_id_foreign" foreign key ("created_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "document_participants" add constraint "document_participants_document_id_foreign" foreign key ("document_id") references "documents" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "document_participants" add constraint "document_participants_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "document_participants" add constraint "document_participants_added_by_id_foreign" foreign key ("added_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "document_files" add constraint "document_files_document_id_foreign" foreign key ("document_id") references "documents" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "document_files" add constraint "document_files_uploaded_by_id_foreign" foreign key ("uploaded_by_id") references "users" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "document_participants" drop constraint "document_participants_document_id_foreign";`);

    this.addSql(`alter table "document_files" drop constraint "document_files_document_id_foreign";`);

    this.addSql(`drop table if exists "documents" cascade;`);

    this.addSql(`drop table if exists "document_participants" cascade;`);

    this.addSql(`drop table if exists "document_files" cascade;`);
  }

}
