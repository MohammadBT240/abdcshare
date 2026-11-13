import { Migration } from '@mikro-orm/migrations';

/**
 * Help Center H1: summaries, default (repo-synced) articles, full-text search and feedback.
 * The S4 "using-the-library" article becomes a default article — docs/help/library owns it from now on.
 */
export class Migration20261112202202 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "help_assets" ("hash" varchar(64) not null, "storage_key" text not null, "created_at" timestamptz not null, constraint "help_assets_pkey" primary key ("hash"));`);

    this.addSql(`create table "help_feedback" ("id" uuid not null, "article_id" uuid not null, "user_id" uuid not null, "helpful" boolean not null, "comment" text null, "updated_at" timestamptz not null, constraint "help_feedback_pkey" primary key ("id"));`);
    this.addSql(`alter table "help_feedback" add constraint "help_feedback_article_id_user_id_unique" unique ("article_id", "user_id");`);

    this.addSql(`alter table "help_feedback" add constraint "help_feedback_article_id_foreign" foreign key ("article_id") references "help_articles" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "help_feedback" add constraint "help_feedback_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "help_categories" add column "description" text null, add column "source" text not null default 'custom';`);

    this.addSql(`alter table "help_articles" add column "summary" text null, add column "source" text not null default 'custom', add column "default_hash" varchar(64) null, add column "related" jsonb not null default '[]', add column "search_vector" tsvector generated always as (setweight(to_tsvector('english', coalesce("title"::text, '')), 'A'::"char") || setweight(to_tsvector('english', coalesce("summary", '')), 'B'::"char") || setweight(to_tsvector('english', coalesce("body_text", '')), 'C'::"char")) stored null;`);
    this.addSql(`create index "help_articles_search_vector_idx" on "public"."help_articles" using gin("search_vector");`);

    this.addSql(`update "help_categories" set "source" = 'default' where "slug" = 'library';`);
    this.addSql(`update "help_articles" set "source" = 'default' where "slug" = 'using-the-library' and "created_by_id" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "help_assets" cascade;`);
    this.addSql(`drop table if exists "help_feedback" cascade;`);

    this.addSql(`drop index "help_articles_search_vector_idx";`);
    // The generated column depends on "summary", so it goes first.
    this.addSql(`alter table "help_articles" drop column "search_vector";`);
    this.addSql(`alter table "help_articles" drop column "summary", drop column "source", drop column "default_hash", drop column "related";`);

    this.addSql(`alter table "help_categories" drop column "description", drop column "source";`);
  }

}
