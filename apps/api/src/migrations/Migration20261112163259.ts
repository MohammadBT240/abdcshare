import { Migration } from '@mikro-orm/migrations';

/** S1: library collections (trainings, workshops, projects…) and their ordered memberships. */
export class Migration20261112163259 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "library_collections" ("id" uuid not null, "title" varchar(200) not null, "slug" varchar(255) not null, "type" text check ("type" in ('Training', 'Workshop', 'Conference', 'Project', 'Programme', 'Other')) not null, "description" text null, "starts_on" date null, "ends_on" date null, "facilitator" text null, "venue" text null, "external_url" text null, "visibility" text check ("visibility" in ('Firm', 'Departments')) not null default 'Firm', "status" text check ("status" in ('Active', 'Archived')) not null default 'Active', "owner_id" uuid not null, "archived_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "library_collections_pkey" primary key ("id"));`);
    this.addSql(`alter table "library_collections" add constraint "library_collections_slug_unique" unique ("slug");`);
    this.addSql(`create index "library_collections_owner_id_index" on "library_collections" ("owner_id");`);
    this.addSql(`create index "library_collections_browse_idx" on "library_collections" ("status", "starts_on", "id");`);

    this.addSql(`create table "library_collection_items" ("collection_id" uuid not null, "item_id" uuid not null, "position" int not null default 0, "section" varchar(80) null, "added_by_id" uuid null, "added_at" timestamptz not null, constraint "library_collection_items_pkey" primary key ("collection_id", "item_id"));`);
    this.addSql(`create index "library_collection_items_item_idx" on "library_collection_items" ("item_id");`);
    this.addSql(`create index "library_collection_items_position_idx" on "library_collection_items" ("collection_id", "position");`);

    this.addSql(`create table "library_collection_departments" ("collection_id" uuid not null, "department_id" int not null, constraint "library_collection_departments_pkey" primary key ("collection_id", "department_id"));`);

    this.addSql(`alter table "library_collections" add constraint "library_collections_owner_id_foreign" foreign key ("owner_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "library_collection_items" add constraint "library_collection_items_collection_id_foreign" foreign key ("collection_id") references "library_collections" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "library_collection_items" add constraint "library_collection_items_item_id_foreign" foreign key ("item_id") references "library_items" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "library_collection_items" add constraint "library_collection_items_added_by_id_foreign" foreign key ("added_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "library_collection_departments" add constraint "library_collection_departments_collection_id_foreign" foreign key ("collection_id") references "library_collections" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "library_collection_departments" add constraint "library_collection_departments_department_id_foreign" foreign key ("department_id") references "departments" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "library_collection_items" drop constraint "library_collection_items_collection_id_foreign";`);

    this.addSql(`alter table "library_collection_departments" drop constraint "library_collection_departments_collection_id_foreign";`);

    this.addSql(`drop table if exists "library_collections" cascade;`);

    this.addSql(`drop table if exists "library_collection_items" cascade;`);

    this.addSql(`drop table if exists "library_collection_departments" cascade;`);
  }

}
