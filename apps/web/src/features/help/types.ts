export type HelpSource = 'default' | 'custom';

export interface HelpArticleSummary {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  summary?: string | null;
  status: 'draft' | 'published';
  order: number;
  /** `default` = shipped with the app (docs/help); `custom` = written here. */
  source?: HelpSource;
  /** A built-in article that was changed in the app — updates from the app are no longer applied. */
  edited?: boolean;
  updatedAt?: string;
}

export interface HelpCategoryWithArticles {
  id: string;
  name: string;
  slug: string;
  order: number;
  icon?: string | null;
  description?: string | null;
  articles: HelpArticleSummary[];
}

export interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  icon?: string | null;
  description?: string | null;
  source?: HelpSource;
}

export interface HelpArticle {
  id: string;
  categoryId: string;
  category?: { id: string; name: string; slug: string };
  title: string;
  slug: string;
  summary?: string | null;
  bodyJson: Record<string, unknown>;
  visibleToRoles: string[];
  status: 'draft' | 'published';
  order: number;
  source?: HelpSource;
  edited?: boolean;
  related?: HelpArticleSummary[];
  /** The viewer's own "Was this helpful?" answer. */
  myFeedback?: boolean | null;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface HelpSearchResult {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  category: string;
  /** Body excerpt; matches wrapped in ⟦ ⟧. */
  snippet?: string | null;
}

export interface HelpFeedbackStats {
  articleId: string;
  slug: string;
  title: string;
  helpful: number;
  notHelpful: number;
  lastAt?: string | null;
  comments: { comment: string; helpful: boolean; by: string; at: string }[];
}
