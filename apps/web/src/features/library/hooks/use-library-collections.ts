'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type {
  LibraryCollection,
  LibraryCollectionFields,
  LibraryCollectionMember,
  Paginated,
} from '@/features/library/types';

const KEY = ['library'] as const;

export function useLibraryCollections(apiQuery: string, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'collections', apiQuery],
    queryFn: () => bffApi<Paginated<LibraryCollection>>(`/api/library/collections?${apiQuery}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Collections the viewer can add items to (their own; all for curators). */
export function useEditableCollections(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'collections', 'editable'],
    queryFn: async () =>
      (await bffApi<Paginated<LibraryCollection>>('/api/library/collections?editable=true&page=1&pageSize=100')).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useLibraryCollection(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'collection', id],
    queryFn: () => bffApi<LibraryCollection>(`/api/library/collections/${id}`),
    enabled: Boolean(id),
    retry: (count, err) => !(err && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) && count < 2,
  });
}

export function useCollectionItems(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'collection', id, 'items'],
    queryFn: () => bffApi<Paginated<LibraryCollectionMember>>(`/api/library/collections/${id}/items?page=1&pageSize=100`),
    enabled: Boolean(id),
  });
}

function useInvalidateCollections() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [...KEY, 'collections'] }),
      qc.invalidateQueries({ queryKey: [...KEY, 'collection'] }),
      qc.invalidateQueries({ queryKey: [...KEY, 'items'] }),
      qc.invalidateQueries({ queryKey: [...KEY, 'item'] }),
    ]);
}

export function useCollectionMutations() {
  const invalidate = useInvalidateCollections();
  const create = useMutation({
    mutationFn: (body: LibraryCollectionFields) =>
      bffApi<LibraryCollection>('/api/library/collections', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<LibraryCollectionFields> }) =>
      bffApi<LibraryCollection>(`/api/library/collections/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: ({ id, archive: a }: { id: string; archive: boolean }) =>
      bffApi<LibraryCollection>(`/api/library/collections/${id}/${a ? 'archive' : 'restore'}`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => bffApi<void>(`/api/library/collections/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  const addItems = useMutation({
    mutationFn: ({ id, itemIds, section }: { id: string; itemIds: string[]; section?: string | null }) =>
      bffApi<{ added: number }>(`/api/library/collections/${id}/items`, {
        method: 'POST',
        body: JSON.stringify({ itemIds, section: section || undefined }),
      }),
    onSuccess: invalidate,
  });
  const removeItem = useMutation({
    mutationFn: ({ id, itemId }: { id: string; itemId: string }) =>
      bffApi<void>(`/api/library/collections/${id}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: ({ id, items }: { id: string; items: { itemId: string; section?: string | null }[] }) =>
      bffApi<{ ok: true }>(`/api/library/collections/${id}/items/order`, { method: 'PUT', body: JSON.stringify({ items }) }),
    onSuccess: invalidate,
  });
  const exportZip = useMutation({
    mutationFn: (id: string) =>
      bffApi<{ accepted: true; files: number }>(`/api/library/collections/${id}/export`, { method: 'POST' }),
  });
  return { create, update, archive, remove, addItems, removeItem, reorder, exportZip };
}
