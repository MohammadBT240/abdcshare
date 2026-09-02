'use client';

import { useQuery } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type { HelpArticle, HelpArticleSummary, HelpCategoryWithArticles } from '../types';

export function useHelpCategories() {
  return useQuery({
    queryKey: ['help', 'categories'],
    queryFn: () => bffApi<HelpCategoryWithArticles[]>('/api/help/categories'),
  });
}

export function useHelpArticle(slug: string) {
  return useQuery({
    queryKey: ['help', 'article', slug],
    queryFn: () => bffApi<HelpArticle>(`/api/help/articles/${encodeURIComponent(slug)}`),
    enabled: Boolean(slug),
  });
}

export function useHelpSearch(query: string) {
  return useQuery({
    queryKey: ['help', 'search', query],
    queryFn: () => bffApi<HelpArticleSummary[]>(`/api/help/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 1,
  });
}
