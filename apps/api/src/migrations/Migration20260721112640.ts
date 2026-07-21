import { Migration } from '@mikro-orm/migrations';

export class Migration20260721112640 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "engagements" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "client_id" uuid not null, "engagement_type_id" int not null, "department_id" int not null, "reference_code" varchar(255) not null, "title" varchar(255) not null, "period_label" varchar(255) null, "status" text check ("status" in ('Planning', 'Fieldwork', 'Review', 'Completed', 'Archived')) not null default 'Planning', "start_date" date null, "target_completion_date" date null, "completed_at" timestamptz null, "created_by_id" uuid null, constraint "engagements_pkey" primary key ("id"));`);
    this.addSql(`alter table "engagements" add constraint "engagements_reference_code_unique" unique ("reference_code");`);

    this.addSql(`create table "engagement_team_members" ("engagement_id" uuid not null, "user_id" uuid not null, "member_role" text check ("member_role" in ('Partner', 'Manager', 'Auditor')) not null, "assigned_by_id" uuid null, "assigned_at" timestamptz not null, constraint "engagement_team_members_pkey" primary key ("engagement_id", "user_id"));`);

    this.addSql(`create table "engagement_status_history" ("id" uuid not null, "engagement_id" uuid not null, "from_status" text check ("from_status" in ('Planning', 'Fieldwork', 'Review', 'Completed', 'Archived')) null, "to_status" text check ("to_status" in ('Planning', 'Fieldwork', 'Review', 'Completed', 'Archived')) not null, "changed_by_id" uuid null, "changed_at" timestamptz not null, "note" text null, constraint "engagement_status_history_pkey" primary key ("id"));`);

    this.addSql(`create table "engagement_fs_lines" ("engagement_id" uuid not null, "fs_line_id" int not null, "sort_order" int not null default 0, "added_by_id" uuid null, constraint "engagement_fs_lines_pkey" primary key ("engagement_id", "fs_line_id"));`);

    this.addSql(`alter table "engagements" add constraint "engagements_client_id_foreign" foreign key ("client_id") references "clients" ("id") on update cascade;`);
    this.addSql(`alter table "engagements" add constraint "engagements_engagement_type_id_foreign" foreign key ("engagement_type_id") references "engagement_types" ("id") on update cascade;`);
    this.addSql(`alter table "engagements" add constraint "engagements_department_id_foreign" foreign key ("department_id") references "departments" ("id") on update cascade;`);
    this.addSql(`alter table "engagements" add constraint "engagements_created_by_id_foreign" foreign key ("created_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "engagement_team_members" add constraint "engagement_team_members_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "engagement_team_members" add constraint "engagement_team_members_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "engagement_team_members" add constraint "engagement_team_members_assigned_by_id_foreign" foreign key ("assigned_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "engagement_status_history" add constraint "engagement_status_history_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "engagement_status_history" add constraint "engagement_status_history_changed_by_id_foreign" foreign key ("changed_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "engagement_fs_lines" add constraint "engagement_fs_lines_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "engagement_fs_lines" add constraint "engagement_fs_lines_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade;`);
    this.addSql(`alter table "engagement_fs_lines" add constraint "engagement_fs_lines_added_by_id_foreign" foreign key ("added_by_id") references "users" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "engagement_team_members" drop constraint "engagement_team_members_engagement_id_foreign";`);

    this.addSql(`alter table "engagement_status_history" drop constraint "engagement_status_history_engagement_id_foreign";`);

    this.addSql(`alter table "engagement_fs_lines" drop constraint "engagement_fs_lines_engagement_id_foreign";`);

    this.addSql(`drop table if exists "engagements" cascade;`);

    this.addSql(`drop table if exists "engagement_team_members" cascade;`);

    this.addSql(`drop table if exists "engagement_status_history" cascade;`);

    this.addSql(`drop table if exists "engagement_fs_lines" cascade;`);
  }

}
