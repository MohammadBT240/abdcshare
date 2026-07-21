import { Migration } from '@mikro-orm/migrations';

export class Migration20260721130245 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "client_submissions" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "request_id" uuid not null, "submitted_by_id" uuid not null, "message" text not null, "status" text check ("status" in ('Pending', 'Accepted', 'Returned')) not null default 'Pending', "reviewed_by_id" uuid null, "review_reason" text null, "reviewed_at" timestamptz null, constraint "client_submissions_pkey" primary key ("id"));`);

    this.addSql(`alter table "client_submissions" add constraint "client_submissions_request_id_foreign" foreign key ("request_id") references "requests" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "client_submissions" add constraint "client_submissions_submitted_by_id_foreign" foreign key ("submitted_by_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "client_submissions" add constraint "client_submissions_reviewed_by_id_foreign" foreign key ("reviewed_by_id") references "users" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "client_submissions" cascade;`);
  }

}
