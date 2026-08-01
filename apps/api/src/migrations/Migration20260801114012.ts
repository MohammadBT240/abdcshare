import { Migration } from '@mikro-orm/migrations';

export class Migration20260801114012 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "company_profiles" ("id" uuid not null, "name" varchar(255) not null, "storage_key" varchar(255) not null, "file_name" varchar(255) not null, "mime_type" varchar(255) null, "size_bytes" int null, "is_active" boolean not null default true, "created_by_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "company_profiles_pkey" primary key ("id"));`);

    this.addSql(`alter table "company_profiles" add constraint "company_profiles_created_by_id_foreign" foreign key ("created_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`drop table if exists "company_profile" cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`create table "company_profile" ("id" serial primary key, "name" varchar(255) not null, "logo_path" varchar(255) null, "email" varchar(255) null, "phone" varchar(255) null, "address" text null, "updated_by_id" uuid null, "updated_at" timestamptz not null);`);

    this.addSql(`alter table "company_profile" add constraint "company_profile_updated_by_id_foreign" foreign key ("updated_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`drop table if exists "company_profiles" cascade;`);
  }

}
