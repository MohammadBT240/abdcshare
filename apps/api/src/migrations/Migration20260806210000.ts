import { Migration } from '@mikro-orm/migrations';

/**
 * Engagement client contacts: N contacts per engagement (1 main), email flags,
 * backfill from client.primary_contact_id.
 */
export class Migration20260806210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "engagement_client_contacts" (
        "engagement_id" uuid not null,
        "user_id" uuid not null,
        "is_main" boolean not null default false,
        "receive_email" boolean not null default false,
        "assigned_by_id" uuid null,
        "assigned_at" timestamptz not null default now(),
        constraint "engagement_client_contacts_pkey" primary key ("engagement_id", "user_id")
      );
    `);
    this.addSql(
      `alter table "engagement_client_contacts" add constraint "engagement_client_contacts_engagement_id_foreign" foreign key ("engagement_id") references "engagements" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "engagement_client_contacts" add constraint "engagement_client_contacts_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete no action;`,
    );
    this.addSql(
      `alter table "engagement_client_contacts" add constraint "engagement_client_contacts_assigned_by_id_foreign" foreign key ("assigned_by_id") references "users" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `create unique index "engagement_client_contacts_one_main" on "engagement_client_contacts" ("engagement_id") where "is_main" = true;`,
    );

    // Backfill: each engagement gets its client's primary contact as main + email.
    this.addSql(`
      insert into "engagement_client_contacts" ("engagement_id", "user_id", "is_main", "receive_email", "assigned_at")
      select e."id", c."primary_contact_id", true, true, now()
      from "engagements" e
      inner join "clients" c on c."id" = e."client_id"
      where c."primary_contact_id" is not null
      on conflict do nothing;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "engagement_client_contacts" cascade;`);
  }
}
