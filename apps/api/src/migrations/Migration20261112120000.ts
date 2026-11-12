import { Migration } from '@mikro-orm/migrations';

/**
 * Staff knowledge library (design: abdcshare/library-design.md).
 * - library_categories (+ 6 seeded rows)
 * - library_items with a generated, weighted tsvector over metadata (title A; tags+authors B;
 *   description+source+file name C) and GIN indexes on it and on tags
 * - library_item_departments pivot for department-restricted items
 */
export class Migration20261112120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table "library_categories" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "slug" varchar(255) not null, "description" text null, "sort_order" int not null default 0, "is_active" boolean not null default true, constraint "library_categories_pkey" primary key ("id"));`);
    this.addSql(`alter table "library_categories" add constraint "library_categories_name_unique" unique ("name");`);
    this.addSql(`alter table "library_categories" add constraint "library_categories_slug_unique" unique ("slug");`);

    // array_to_string is STABLE; generated columns need IMMUTABLE expressions.
    this.addSql(`create or replace function library_tags_text(text[]) returns text language sql immutable parallel safe as $$ select array_to_string($1, ' ') $$;`);

    this.addSql(`create table "library_items" (
      "id" uuid not null,
      "title" varchar(300) not null,
      "description" text null,
      "category_id" uuid not null,
      "authors" text null,
      "published_year" int null,
      "source" text null,
      "tags" text[] not null default '{}',
      "visibility" text check ("visibility" in ('Firm', 'Departments')) not null default 'Firm',
      "status" text check ("status" in ('Draft', 'Published', 'Archived')) not null default 'Draft',
      "storage_key" varchar(255) null,
      "file_name" varchar(255) null,
      "mime_type" varchar(255) null,
      "size_bytes" int null,
      "preview_storage_key" varchar(255) null,
      "preview_status" text check ("preview_status" in ('None', 'Pending', 'Ready', 'Failed')) not null default 'None',
      "preview_error" text null,
      "uploaded_by_id" uuid not null,
      "published_at" timestamptz null,
      "archived_by_id" uuid null,
      "archived_at" timestamptz null,
      "view_count" int not null default 0,
      "download_count" int not null default 0,
      "search_vector" tsvector generated always as (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce(library_tags_text("tags"), '') || ' ' || coalesce("authors", '')), 'B') || setweight(to_tsvector('english', coalesce("description", '') || ' ' || coalesce("source", '') || ' ' || coalesce("file_name", '')), 'C')) stored,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      constraint "library_items_pkey" primary key ("id"));`);
    this.addSql(`create index "library_items_published_year_index" on "library_items" ("published_year");`);
    this.addSql(`create index "library_items_uploaded_by_id_index" on "library_items" ("uploaded_by_id");`);
    this.addSql(`create index "library_items_browse_idx" on "library_items" ("status", "category_id", "published_at", "id");`);
    this.addSql(`create index "library_items_tags_idx" on "library_items" using gin ("tags");`);
    this.addSql(`create index "library_items_search_vector_idx" on "library_items" using gin ("search_vector");`);

    this.addSql(`alter table "library_items" add constraint "library_items_category_id_foreign" foreign key ("category_id") references "library_categories" ("id") on update cascade;`);
    this.addSql(`alter table "library_items" add constraint "library_items_uploaded_by_id_foreign" foreign key ("uploaded_by_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "library_items" add constraint "library_items_archived_by_id_foreign" foreign key ("archived_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`create table "library_item_departments" ("item_id" uuid not null, "department_id" int not null, constraint "library_item_departments_pkey" primary key ("item_id", "department_id"));`);
    this.addSql(`alter table "library_item_departments" add constraint "library_item_departments_item_id_foreign" foreign key ("item_id") references "library_items" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "library_item_departments" add constraint "library_item_departments_department_id_foreign" foreign key ("department_id") references "departments" ("id") on update cascade on delete cascade;`);

    // Seed categories (idempotent on slug).
    this.addSql(`insert into "library_categories" ("id", "created_at", "updated_at", "name", "slug", "description", "sort_order", "is_active") values
      (gen_random_uuid(), now(), now(), 'Reports', 'reports', 'Engagement, sector and internal reports', 10, true),
      (gen_random_uuid(), now(), now(), 'Research Papers', 'research-papers', 'Academic and industry research', 20, true),
      (gen_random_uuid(), now(), now(), 'Training Materials', 'training-materials', 'Course notes, slides and workshop material', 30, true),
      (gen_random_uuid(), now(), now(), 'Templates & Tools', 'templates-tools', 'Reusable templates, checklists and workbooks', 40, true),
      (gen_random_uuid(), now(), now(), 'Policies & Methodology', 'policies-methodology', 'Firm policies, manuals and methodology', 50, true),
      (gen_random_uuid(), now(), now(), 'Regulatory & Standards', 'regulatory-standards', 'Standards, regulations and circulars', 60, true)
      on conflict ("slug") do nothing;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "library_item_departments" cascade;`);
    this.addSql(`drop table if exists "library_items" cascade;`);
    this.addSql(`drop table if exists "library_categories" cascade;`);
    this.addSql(`drop function if exists library_tags_text(text[]);`);
  }
}
