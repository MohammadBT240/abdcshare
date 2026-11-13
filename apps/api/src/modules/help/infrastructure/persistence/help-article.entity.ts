import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { HelpCategoryEntity } from './help-category.entity';

export type HelpArticleStatus = 'draft' | 'published';
/** `default` = shipped in docs/help and kept in sync; `custom` = written in the admin editor. */
export type HelpArticleSource = 'default' | 'custom';

/**
 * Weighted full-text document (Help Center HC5). Written in the shape Postgres normalises it to so
 * MikroORM's schema diff stays clean — keep in sync with Migration20261112202202.
 */
export const HELP_SEARCH_VECTOR_SQL =
  `(setweight(to_tsvector('english', coalesce("title"::text, '')), 'A'::"char") || ` +
  `setweight(to_tsvector('english', coalesce("summary", '')), 'B'::"char") || ` +
  `setweight(to_tsvector('english', coalesce("body_text", '')), 'C'::"char")) stored`;

@Entity({ tableName: 'help_articles' })
@Unique({ properties: ['slug'] })
@Index({ name: 'help_articles_search_vector_idx', properties: ['searchVector'], type: 'fulltext' })
export class HelpArticleEntity {
  [OptionalProps]?: 'status' | 'order' | 'updatedAt' | 'visibleToRoles' | 'source' | 'related';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => HelpCategoryEntity)
  category!: HelpCategoryEntity;

  @Property()
  title!: string;

  @Property()
  slug!: string;

  /** One-line description shown under the title, on cards and in search results. */
  @Property({ type: 'text', nullable: true })
  summary?: string | null;

  @Property({ type: 'json' })
  bodyJson!: Record<string, unknown>;

  /** Plain-text extract of bodyJson, computed client-side (editor.getText()) at save time — used for ILIKE search. */
  @Property({ type: 'text' })
  bodyText!: string;

  /** Empty array = visible to every role. */
  @Property({ type: 'json', defaultRaw: `'[]'` })
  visibleToRoles: string[] = [];

  /** Plain text column, not @Enum — a two-value status flag doesn't warrant a shared cross-package enum. */
  @Property({ type: 'text' })
  status: HelpArticleStatus = 'draft';

  @Property({ default: 0 })
  order: number = 0;

  @Property({ type: 'text', default: 'custom' })
  source: HelpArticleSource = 'custom';

  /**
   * For default articles: hash of the content the last sync wrote. If the stored content no longer
   * matches it, an admin edited the article and the sync leaves it alone (HC1).
   */
  @Property({ length: 64, nullable: true })
  defaultHash?: string | null;

  /** Slugs of related articles (from front matter `related:`), shown at the bottom of the page. */
  @Property({ type: 'json', defaultRaw: `'[]'` })
  related: string[] = [];

  @Property({ columnType: 'tsvector', generated: HELP_SEARCH_VECTOR_SQL, lazy: true, hidden: true, nullable: true })
  searchVector?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;
}
