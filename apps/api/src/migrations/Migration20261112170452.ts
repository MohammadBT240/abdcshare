import { Migration } from '@mikro-orm/migrations';

export class Migration20261112170452 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "library_reports" ("id" uuid not null, "item_id" uuid null, "item_title" varchar(300) not null, "reporter_id" uuid not null, "reason" text check ("reason" in ('ClientConfidential', 'Copyright', 'OutdatedOrWrong', 'Inappropriate', 'Other')) not null, "note" text null, "status" text check ("status" in ('Open', 'Dismissed', 'Actioned')) not null default 'Open', "outcome" text check ("outcome" in ('Dismiss', 'Restrict', 'Archive', 'Delete')) null, "resolution" text null, "resolved_by_id" uuid null, "resolved_at" timestamptz null, "created_at" timestamptz not null, constraint "library_reports_pkey" primary key ("id"));`);
    this.addSql(`create index "library_reports_item_idx" on "library_reports" ("item_id");`);
    this.addSql(`create index "library_reports_status_created_idx" on "library_reports" ("status", "created_at");`);

    this.addSql(`create table "library_events" ("id" bigserial primary key, "item_id" uuid null, "collection_id" uuid null, "actor_id" uuid null, "action" text check ("action" in ('Viewed', 'Downloaded', 'Uploaded', 'FileReplaced', 'Edited', 'VisibilityChanged', 'Archived', 'Restored', 'Deleted', 'Reported', 'ReportResolved', 'OwnershipTransferred', 'AddedToCollection', 'RemovedFromCollection', 'ZipExported')) not null, "ip" varchar(64) null, "user_agent" varchar(300) null, "metadata" jsonb null, "created_at" timestamptz not null default now());`);
    this.addSql(`create index "library_events_collection_idx" on "library_events" ("collection_id");`);
    this.addSql(`create index "library_events_action_created_idx" on "library_events" ("action", "created_at" desc);`);
    this.addSql(`create index "library_events_actor_created_idx" on "library_events" ("actor_id", "created_at" desc);`);
    this.addSql(`create index "library_events_item_created_idx" on "library_events" ("item_id", "created_at" desc);`);

    this.addSql(`alter table "library_reports" add constraint "library_reports_item_id_foreign" foreign key ("item_id") references "library_items" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "library_reports" add constraint "library_reports_reporter_id_foreign" foreign key ("reporter_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "library_reports" add constraint "library_reports_resolved_by_id_foreign" foreign key ("resolved_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "library_events" add constraint "library_events_item_id_foreign" foreign key ("item_id") references "library_items" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "library_events" add constraint "library_events_collection_id_foreign" foreign key ("collection_id") references "library_collections" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "library_events" add constraint "library_events_actor_id_foreign" foreign key ("actor_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "library_items" add column "licence" text check ("licence" in ('FreeToShare', 'InternalUseOnly', 'Licensed')) not null default 'InternalUseOnly', add column "licence_note" text null, add column "downloadable" boolean not null default true, add column "declared_at" timestamptz null, add column "declared_by_id" uuid null;`);
    this.addSql(`alter table "library_items" add constraint "library_items_declared_by_id_foreign" foreign key ("declared_by_id") references "users" ("id") on update cascade on delete set null;`);

    // S2 D15: the activity log is append-only. Allowed updates: FK "set null" on delete of the item /
    // collection / actor, and adding keys to metadata (the title snapshot before an item is deleted).
    this.addSql(`create or replace function library_events_append_only() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'library_events is append-only';
  end if;
  if new.id <> old.id or new.action <> old.action or new.created_at <> old.created_at
     or new.ip is distinct from old.ip or new.user_agent is distinct from old.user_agent
     or (new.item_id is distinct from old.item_id and new.item_id is not null)
     or (new.collection_id is distinct from old.collection_id and new.collection_id is not null)
     or (new.actor_id is distinct from old.actor_id and new.actor_id is not null)
     or not (coalesce(new.metadata, '{}'::jsonb) @> coalesce(old.metadata, '{}'::jsonb)) then
    raise exception 'library_events is append-only';
  end if;
  return new;
end $$;`);
    this.addSql(`create trigger library_events_append_only before update or delete on "library_events" for each row execute function library_events_append_only();`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "library_reports" cascade;`);

    this.addSql(`drop trigger if exists library_events_append_only on "library_events";`);
    this.addSql(`drop function if exists library_events_append_only();`);

    this.addSql(`drop table if exists "library_events" cascade;`);

    this.addSql(`alter table "library_items" drop constraint "library_items_declared_by_id_foreign";`);

    this.addSql(`alter table "library_items" drop column "licence", drop column "licence_note", drop column "downloadable", drop column "declared_at", drop column "declared_by_id";`);
  }

}
