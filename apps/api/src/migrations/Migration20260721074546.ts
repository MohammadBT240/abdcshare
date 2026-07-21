import { Migration } from '@mikro-orm/migrations';

export class Migration20260721074546 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "bulk_import_jobs" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "kind" text check ("kind" in ('Users')) not null default 'Users', "status" text check ("status" in ('Pending', 'Validated', 'Imported', 'Failed')) not null default 'Pending', "total_rows" int not null default 0, "valid_rows" int not null default 0, "error_rows" int not null default 0, "result" jsonb null, "created_by_id" uuid null, "completed_at" timestamptz null, constraint "bulk_import_jobs_pkey" primary key ("id"));`);

    this.addSql(`alter table "bulk_import_jobs" add constraint "bulk_import_jobs_created_by_id_foreign" foreign key ("created_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "company_profile" alter column "id" type int using ("id"::int);`);
    this.addSql(`alter table "company_profile" alter column "id" set default 1;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "bulk_import_jobs" cascade;`);

    this.addSql(`alter table "company_profile" alter column "id" drop default;`);
    this.addSql(`alter table "company_profile" alter column "id" type int4 using ("id"::int4);`);
  }

}
