import { Migration } from '@mikro-orm/migrations';

export class Migration20260721180713 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "notification_preferences" ("user_id" uuid not null, "notification_type" varchar(255) not null, "email_enabled" boolean not null default true, "in_app_enabled" boolean not null default true, constraint "notification_preferences_pkey" primary key ("user_id", "notification_type"));`);

    this.addSql(`create table "notifications" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" uuid not null, "type" varchar(255) not null, "title" varchar(255) not null, "body" text null, "entity_type" varchar(255) null, "entity_id" varchar(255) null, "link" varchar(255) null, "is_read" boolean not null default false, "read_at" timestamptz null, "email_sent" boolean not null default false, "email_sent_at" timestamptz null, constraint "notifications_pkey" primary key ("id"));`);

    this.addSql(`alter table "notification_preferences" add constraint "notification_preferences_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "notifications" add constraint "notifications_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "notification_preferences" cascade;`);

    this.addSql(`drop table if exists "notifications" cascade;`);
  }

}
