export interface HelpArticleSummary {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  order: number;
}

export interface HelpCategoryWithArticles {
  id: string;
  name: string;
  slug: string;
  order: number;
  icon?: string | null;
  articles: HelpArticleSummary[];
}

export interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  icon?: string | null;
}

export interface HelpArticle {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  bodyJson: Record<string, unknown>;
  visibleToRoles: string[];
  status: 'draft' | 'published';
  order: number;
  updatedAt: string;
  publishedAt?: string | null;
}
