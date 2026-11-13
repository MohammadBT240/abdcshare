'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type { HelpArticle, HelpArticleSummary, HelpCategory, HelpFeedbackStats } from '../types';

interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface HelpArticleListResponse {
  data: HelpArticleSummary[];
  meta: PageMeta;
}

const categoriesKey = ['help', 'admin', 'categories'] as const;

export function useHelpCategoriesAdmin() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: () => bffApi<HelpCategory[]>('/api/help/admin/categories'),
  });
}

export function useHelpArticlesAdmin(params: { categoryId?: string; status?: 'draft' | 'published'; page?: number }) {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.status) qs.set('status', params.status);
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', '100');
  return useQuery({
    queryKey: ['help', 'admin', 'articles', qs.toString()],
    queryFn: () => bffApi<HelpArticleListResponse>(`/api/help/admin/articles?${qs.toString()}`),
    placeholderData: keepPreviousData,
  });
}

/** Authoring fetch by id — the editor is keyed by the route's article id, not by slug. */
export function useHelpArticleAdmin(id: string) {
  return useQuery({
    queryKey: ['help', 'admin', 'article', id],
    queryFn: () => bffApi<HelpArticle>(`/api/help/admin/articles/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  });
}

export function useCreateHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; slug: string; order?: number; icon?: string }) =>
      bffApi<HelpCategory>('/api/help/categories', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  });
}

export function useUpdateHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name?: string; slug?: string; order?: number; icon?: string }) =>
      bffApi<HelpCategory>(`/api/help/categories/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  });
}

export function useDeleteHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<void>(`/api/help/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  });
}

/** Admin lists and every reader view (sidebar, articles, search) — they all show article data. */
function invalidateArticles(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ['help'] });
}

export function useDeleteHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<void>(`/api/help/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export function usePublishHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi(`/api/help/articles/${id}/publish`, { method: 'POST' }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export function useUnpublishHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi(`/api/help/articles/${id}/unpublish`, { method: 'POST' }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export interface HelpArticleWriteDto {
  categoryId: string;
  title: string;
  slug: string;
  bodyJson: Record<string, unknown>;
  bodyText: string;
  summary?: string | null;
  visibleToRoles?: string[];
  order?: number;
}

export function useCreateHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: HelpArticleWriteDto) =>
      bffApi<{ id: string }>('/api/help/articles', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export function useUpdateHelpArticle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<HelpArticleWriteDto>) =>
      bffApi<{ id: string }>(`/api/help/articles/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: async () => {
      await invalidateArticles(qc);
      await qc.invalidateQueries({ queryKey: ['help', 'admin', 'article', id] });
    },
  });
}

/** Throw away in-app edits to a built-in article and re-install the shipped version. */
export function useRestoreHelpDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<HelpArticle>(`/api/help/articles/${id}/restore-default`, { method: 'POST' }),
    onSuccess: async (_d, id) => {
      await invalidateArticles(qc);
      await qc.invalidateQueries({ queryKey: ['help', 'admin', 'article', id] });
    },
  });
}

export interface HelpSyncResult {
  skipped?: 'locked' | 'no-content';
  created: string[];
  updated: string[];
  unchanged: number;
  keptEdited: string[];
  conflicts: string[];
  retired: string[];
  imagesUploaded: number;
  errors: string[];
}

/** Re-read the built-in articles now (also happens on every API start). */
export function useSyncHelpDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bffApi<HelpSyncResult>('/api/help/admin/sync', { method: 'POST' }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export function useHelpFeedbackStats(enabled = true) {
  return useQuery({
    queryKey: ['help', 'admin', 'feedback'],
    queryFn: () => bffApi<HelpFeedbackStats[]>('/api/help/admin/feedback'),
    enabled,
  });
}
