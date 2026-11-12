'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type { HelpArticle, HelpCategoryWithArticles, HelpSearchResult } from '../types';

export function useHelpCategories() {
  return useQuery({
    queryKey: ['help', 'categories'],
    queryFn: () => bffApi<HelpCategoryWithArticles[]>('/api/help/categories'),
    staleTime: 5 * 60_000,
  });
}

export function useHelpArticle(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['help', 'article', slug],
    queryFn: () => bffApi<HelpArticle>(`/api/help/articles/${encodeURIComponent(slug)}`),
    enabled: Boolean(slug) && (options?.enabled ?? true),
  });
}

export function useHelpSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['help', 'search', q],
    queryFn: () => bffApi<HelpSearchResult[]>(`/api/help/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 1,
    placeholderData: keepPreviousData,
  });
}

export function useHelpFeedback(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { helpful: boolean; comment?: string | null }) =>
      bffApi<void>(`/api/help/articles/${encodeURIComponent(slug)}/feedback`, { method: 'PUT', body: JSON.stringify(dto) }),
    onSuccess: (_d, dto) =>
      qc.setQueryData<HelpArticle>(['help', 'article', slug], (old) => (old ? { ...old, myFeedback: dto.helpful } : old)),
  });
}
