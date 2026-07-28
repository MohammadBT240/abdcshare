import { Migration } from '@mikro-orm/migrations';

export class Migration20260724110621 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "engagement_sign_offs" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "engagement_id" uuid not null, "request_class_id" int null, "signed_by_id" uuid not null, "signed_at" timestamptz not null, "note" text null, "revoked_by_id" uuid null, "revoked_at" timestamptz null, "revoke_reason" text null, constraint "engagement_sign_offs_pkey" primary key ("id"));`);

    this.addSql(`alter table "engagement_sign_offs" add constraint "engagement_sign_offs_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "engagement_sign_offs" add constraint "engagement_sign_offs_request_class_id_foreign" foreign key ("request_class_id") references "request_classes" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "engagement_sign_offs" add constraint "engagement_sign_offs_signed_by_id_foreign" foreign key ("signed_by_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "engagement_sign_offs" add constraint "engagement_sign_offs_revoked_by_id_foreign" foreign key ("revoked_by_id") references "users" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "engagement_sign_offs" cascade;`);
  }

}
