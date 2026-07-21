import { Migration } from '@mikro-orm/migrations';

export class Migration20260721185958 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "documents" drop constraint "documents_fs_line_id_foreign";`);

    this.addSql(`alter table "engagement_fs_lines" drop constraint "engagement_fs_lines_fs_line_id_foreign";`);

    this.addSql(`alter table "fs_line_engagement_types" drop constraint "fs_line_engagement_types_fs_line_id_foreign";`);

    this.addSql(`alter table "request_types" drop constraint "request_types_fs_line_id_foreign";`);

    this.addSql(`create table "request_classes" ("id" serial primary key, "code" varchar(255) null, "name" varchar(255) not null, "description" text null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "request_classes" add constraint "request_classes_code_unique" unique ("code");`);
    this.addSql(`alter table "request_classes" add constraint "request_classes_name_unique" unique ("name");`);

    this.addSql(`create table "request_class_engagement_types" ("request_class_id" int not null, "engagement_type_id" int not null, constraint "request_class_engagement_types_pkey" primary key ("request_class_id", "engagement_type_id"));`);

    this.addSql(`create table "engagement_request_classes" ("engagement_id" uuid not null, "request_class_id" int not null, "sort_order" int not null default 0, "added_by_id" uuid null, constraint "engagement_request_classes_pkey" primary key ("engagement_id", "request_class_id"));`);

    this.addSql(`alter table "request_class_engagement_types" add constraint "request_class_engagement_types_request_class_id_foreign" foreign key ("request_class_id") references "request_classes" ("id") on update cascade;`);
    this.addSql(`alter table "request_class_engagement_types" add constraint "request_class_engagement_types_engagement_type_id_foreign" foreign key ("engagement_type_id") references "engagement_types" ("id") on update cascade;`);

    this.addSql(`alter table "engagement_request_classes" add constraint "engagement_request_classes_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "engagement_request_classes" add constraint "engagement_request_classes_request_class_id_foreign" foreign key ("request_class_id") references "request_classes" ("id") on update cascade;`);
    this.addSql(`alter table "engagement_request_classes" add constraint "engagement_request_classes_added_by_id_foreign" foreign key ("added_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`drop table if exists "engagement_fs_lines" cascade;`);

    this.addSql(`drop table if exists "fs_line_engagement_types" cascade;`);

    this.addSql(`drop table if exists "fs_lines" cascade;`);

    this.addSql(`alter table "request_types" drop constraint "request_types_fs_line_id_name_unique";`);

    this.addSql(`alter table "request_types" rename column "fs_line_id" to "request_class_id";`);
    this.addSql(`alter table "request_types" add constraint "request_types_request_class_id_foreign" foreign key ("request_class_id") references "request_classes" ("id") on update cascade;`);
    this.addSql(`alter table "request_types" add constraint "request_types_request_class_id_name_unique" unique ("request_class_id", "name");`);


    this.addSql(`alter table "documents" rename column "fs_line_id" to "request_class_id";`);
    this.addSql(`alter table "documents" add constraint "documents_request_class_id_foreign" foreign key ("request_class_id") references "request_classes" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "request_class_engagement_types" drop constraint "request_class_engagement_types_request_class_id_foreign";`);

    this.addSql(`alter table "request_types" drop constraint "request_types_request_class_id_foreign";`);

    this.addSql(`alter table "engagement_request_classes" drop constraint "engagement_request_classes_request_class_id_foreign";`);

    this.addSql(`alter table "documents" drop constraint "documents_request_class_id_foreign";`);

    this.addSql(`create table "engagement_fs_lines" ("engagement_id" uuid not null, "fs_line_id" int4 not null, "sort_order" int4 not null default 0, "added_by_id" uuid null, constraint "engagement_fs_lines_pkey" primary key ("engagement_id", "fs_line_id"));`);

    this.addSql(`create table "fs_line_engagement_types" ("fs_line_id" int4 not null, "engagement_type_id" int4 not null, constraint "fs_line_engagement_types_pkey" primary key ("fs_line_id", "engagement_type_id"));`);

    this.addSql(`create table "fs_lines" ("id" serial primary key, "code" varchar(255) null, "name" varchar(255) not null, "description" text null, "is_active" bool not null default true);`);
    this.addSql(`alter table "fs_lines" add constraint "fs_lines_code_unique" unique ("code");`);
    this.addSql(`alter table "fs_lines" add constraint "fs_lines_name_unique" unique ("name");`);

    this.addSql(`alter table "engagement_fs_lines" add constraint "engagement_fs_lines_added_by_id_foreign" foreign key ("added_by_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "engagement_fs_lines" add constraint "engagement_fs_lines_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "engagement_fs_lines" add constraint "engagement_fs_lines_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade on delete no action;`);

    this.addSql(`alter table "fs_line_engagement_types" add constraint "fs_line_engagement_types_engagement_type_id_foreign" foreign key ("engagement_type_id") references "engagement_types" ("id") on update cascade on delete no action;`);
    this.addSql(`alter table "fs_line_engagement_types" add constraint "fs_line_engagement_types_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade on delete no action;`);

    this.addSql(`drop table if exists "request_classes" cascade;`);

    this.addSql(`drop table if exists "request_class_engagement_types" cascade;`);

    this.addSql(`drop table if exists "engagement_request_classes" cascade;`);


    this.addSql(`alter table "documents" rename column "request_class_id" to "fs_line_id";`);
    this.addSql(`alter table "documents" add constraint "documents_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade on delete no action;`);

    this.addSql(`alter table "request_types" drop constraint "request_types_request_class_id_name_unique";`);

    this.addSql(`alter table "request_types" rename column "request_class_id" to "fs_line_id";`);
    this.addSql(`alter table "request_types" add constraint "request_types_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade on delete no action;`);
    this.addSql(`alter table "request_types" add constraint "request_types_fs_line_id_name_unique" unique ("fs_line_id", "name");`);
  }

}
