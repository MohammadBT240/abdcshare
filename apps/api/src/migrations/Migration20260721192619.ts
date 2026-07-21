import { Migration } from '@mikro-orm/migrations';

export class Migration20260721192619 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "report_review_cycles" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "document_id" uuid not null, "round_no" int not null, "file_version" int not null, "sent_by_id" uuid null, "sent_at" timestamptz not null, "decision" text check ("decision" in ('Pending', 'Approved', 'ChangesRequested')) not null default 'Pending', "decided_by_id" uuid null, "decided_at" timestamptz null, "feedback" text null, constraint "report_review_cycles_pkey" primary key ("id"));`);

    this.addSql(`alter table "report_review_cycles" add constraint "report_review_cycles_document_id_foreign" foreign key ("document_id") references "documents" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "report_review_cycles" add constraint "report_review_cycles_sent_by_id_foreign" foreign key ("sent_by_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "report_review_cycles" add constraint "report_review_cycles_decided_by_id_foreign" foreign key ("decided_by_id") references "users" ("id") on update cascade on delete set null;`);


    this.addSql(`alter table "documents" add column "client_review_state" text check ("client_review_state" in ('NotSent', 'AwaitingClient', 'ChangesRequested', 'Locked', 'Approved', 'Overridden')) not null default 'NotSent', add column "client_review_round" int not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "report_review_cycles" cascade;`);


    this.addSql(`alter table "documents" drop column "client_review_state", drop column "client_review_round";`);
  }

}
