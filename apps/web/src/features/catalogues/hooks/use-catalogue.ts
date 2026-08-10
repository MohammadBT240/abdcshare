'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export interface CatalogueRow {
  id: number;
  name: string;
  isActive: boolean;
  code?: string | null;
  description?: string | null;
  sortOrder?: number;
  requestClassId?: number;
  requestClassName?: string | null;
  expectedDocuments?: number;
  suggestedRequestClassIds?: number[];
}

export interface CatalogueList {
  data: CatalogueRow[];
  meta: PageMeta;
}

export function useCatalogueList(resource: string, queryString: string) {
  return useQuery({
    queryKey: ['catalogue', resource, queryString],
    queryFn: () => bffApi<CatalogueList>(`/api/${resource}?${queryString}`),
    placeholderData: keepPreviousData,
  });
}

export function useCatalogueMutations(resource: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalogue', resource] });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      bffApi<CatalogueRow>(`/api/${resource}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      bffApi<CatalogueRow>(`/api/${resource}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: (id: number) =>
      bffApi<CatalogueRow>(`/api/${resource}/${id}/deactivate`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const setAllowedRequestClasses = useMutation({
    mutationFn: ({ id, requestClassIds }: { id: number; requestClassIds: number[] }) =>
      bffApi<CatalogueRow>(`/api/${resource}/${id}/request-classes`, {
        method: 'PUT',
        body: JSON.stringify({ requestClassIds }),
      }),
    onSuccess: invalidate,
  });

  return { create, update, deactivate, setAllowedRequestClasses };
}
