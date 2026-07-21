import { Migration } from '@mikro-orm/migrations';

export class Migration20260721123912 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "requests" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "engagement_id" uuid not null, "request_type_id" int not null, "stage_id" int null, "status_id" int null, "description" text not null, "due_date" date null, "created_by_id" uuid null, constraint "requests_pkey" primary key ("id"));`);

    this.addSql(`create table "request_history" ("id" uuid not null, "request_id" uuid not null, "actor_id" uuid null, "event_type" varchar(255) not null, "module" varchar(255) not null default 'requests', "from_value" text null, "to_value" text null, "note" text null, "created_at" timestamptz not null, constraint "request_history_pkey" primary key ("id"));`);

    this.addSql(`create table "request_assignees" ("request_id" uuid not null, "user_id" uuid not null, "assigned_by_id" uuid null, "assigned_at" timestamptz not null, constraint "request_assignees_pkey" primary key ("request_id", "user_id"));`);

    this.addSql(`alter table "requests" add constraint "requests_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "requests" add constraint "requests_request_type_id_foreign" foreign key ("request_type_id") references "request_types" ("id") on update cascade;`);
    this.addSql(`alter table "requests" add constraint "requests_stage_id_foreign" foreign key ("stage_id") references "request_stages" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "requests" add constraint "requests_status_id_foreign" foreign key ("status_id") references "request_statuses" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "requests" add constraint "requests_created_by_id_foreign" foreign key ("created_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "request_history" add constraint "request_history_request_id_foreign" foreign key ("request_id") references "requests" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "request_history" add constraint "request_history_actor_id_foreign" foreign key ("actor_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "request_assignees" add constraint "request_assignees_request_id_foreign" foreign key ("request_id") references "requests" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "request_assignees" add constraint "request_assignees_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "request_assignees" add constraint "request_assignees_assigned_by_id_foreign" foreign key ("assigned_by_id") references "users" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "request_history" drop constraint "request_history_request_id_foreign";`);

    this.addSql(`alter table "request_assignees" drop constraint "request_assignees_request_id_foreign";`);

    this.addSql(`drop table if exists "requests" cascade;`);

    this.addSql(`drop table if exists "request_history" cascade;`);

    this.addSql(`drop table if exists "request_assignees" cascade;`);
  }

}
