import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { HelpArticleEntity } from './help-article.entity';

/** "Was this helpful?" — one vote per user per article; the latest answer wins. */
@Entity({ tableName: 'help_feedback' })
@Unique({ properties: ['article', 'user'] })
export class HelpFeedbackEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => HelpArticleEntity, { deleteRule: 'cascade' })
  article!: HelpArticleEntity;

  @ManyToOne(() => UserEntity, { deleteRule: 'cascade' })
  user!: UserEntity;

  @Property()
  helpful!: boolean;

  @Property({ type: 'text', nullable: true })
  comment?: string | null;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
