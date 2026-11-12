import { Migration } from '@mikro-orm/migrations';
import { LIBRARY_SEARCH_VECTOR_SQL } from '../modules/library/infrastructure/persistence/library-item.entity';

/**
 * Re-create `library_items.search_vector` with the expression written the way Postgres normalises it
 * (see LIBRARY_SEARCH_VECTOR_SQL). Same search behaviour as Migration20261112120000; this only stops
 * MikroORM's schema diff from proposing to drop and re-add the column on every `migration:create`.
 */
export class Migration20261112130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "library_items" drop column if exists "search_vector";`);
    this.addSql(`alter table "library_items" add column "search_vector" tsvector generated always as ${LIBRARY_SEARCH_VECTOR_SQL} null;`);
    this.addSql(`create index "library_items_search_vector_idx" on "library_items" using gin ("search_vector");`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "library_items" drop column if exists "search_vector";`);
    this.addSql(`alter table "library_items" add column "search_vector" tsvector generated always as (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce(library_tags_text("tags"), '') || ' ' || coalesce("authors", '')), 'B') || setweight(to_tsvector('english', coalesce("description", '') || ' ' || coalesce("source", '') || ' ' || coalesce("file_name", '')), 'C')) stored;`);
    this.addSql(`create index "library_items_search_vector_idx" on "library_items" using gin ("search_vector");`);
  }
}
