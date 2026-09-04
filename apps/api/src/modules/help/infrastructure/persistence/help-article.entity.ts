import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { HelpCategoryEntity } from './help-category.entity';

export type HelpArticleStatus = 'draft' | 'published';

@Entity({ tableName: 'help_articles' })
@Unique({ properties: ['slug'] })
export class HelpArticleEntity {
  [OptionalProps]?: 'status' | 'order' | 'updatedAt' | 'visibleToRoles';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => HelpCategoryEntity)
  category!: HelpCategoryEntity;

  @Property()
  title!: string;

  @Property()
  slug!: string;

  @Property({ type: 'json' })
  bodyJson!: Record<string, unknown>;

  /** Plain-text extract of bodyJson, computed client-side (editor.getText()) at save time — used for ILIKE search. */
  @Property({ type: 'text' })
  bodyText!: string;

  /** Empty array = visible to every role. */
  @Property({ type: 'json' })
  visibleToRoles: string[] = [];

  /** Plain text column, not @Enum — a two-value status flag doesn't warrant a shared cross-package enum. */
  @Property({ type: 'text' })
  status: HelpArticleStatus = 'draft';

  @Property({ default: 0 })
  order: number = 0;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;
}
