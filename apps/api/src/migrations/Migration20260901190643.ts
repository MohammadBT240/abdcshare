import { Migration } from '@mikro-orm/migrations';

export class Migration20260901190643 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "help_categories" ("id" uuid not null, "name" varchar(255) not null, "slug" varchar(255) not null, "order" int not null default 0, "icon" varchar(255) null, constraint "help_categories_pkey" primary key ("id"));`);
    this.addSql(`alter table "help_categories" add constraint "help_categories_slug_unique" unique ("slug");`);

    this.addSql(`create table "help_articles" ("id" uuid not null, "category_id" uuid not null, "title" varchar(255) not null, "slug" varchar(255) not null, "body_json" jsonb not null, "body_text" text not null, "visible_to_roles" jsonb not null, "status" text not null default 'draft', "order" int not null default 0, "created_by_id" uuid null, "updated_at" timestamptz not null, "published_at" timestamptz null, constraint "help_articles_pkey" primary key ("id"));`);
    this.addSql(`alter table "help_articles" add constraint "help_articles_slug_unique" unique ("slug");`);

    this.addSql(`alter table "help_articles" add constraint "help_articles_category_id_foreign" foreign key ("category_id") references "help_categories" ("id") on update cascade;`);
    this.addSql(`alter table "help_articles" add constraint "help_articles_created_by_id_foreign" foreign key ("created_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "help_articles" alter column "visible_to_roles" set default '[]';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "help_articles" drop constraint "help_articles_category_id_foreign";`);

    this.addSql(`drop table if exists "help_categories" cascade;`);

    this.addSql(`drop table if exists "help_articles" cascade;`);
  }

}
