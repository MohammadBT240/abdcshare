'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import { uploadFilesWithUppy } from '@/lib/uploads/uppy-client';
import { withLibraryMime } from '@/features/library/lib/library-files';
import type {
  LibraryCategory,
  LibraryItem,
  LibraryItemFields,
  LibraryPreview,
  LibraryTag,
  Paginated,
} from '@/features/library/types';

const KEY = ['library'] as const;

// ------------------------------------------------------------------ reads

export function useLibraryItems(apiQuery: string) {
  return useQuery({
    queryKey: [...KEY, 'items', apiQuery],
    queryFn: () => bffApi<Paginated<LibraryItem>>(`/api/library/items?${apiQuery}`),
    placeholderData: keepPreviousData,
  });
}

export function useLibraryItem(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'item', id],
    queryFn: () => bffApi<LibraryItem>(`/api/library/items/${id}`),
    enabled: Boolean(id),
    retry: (count, err) => !(err && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) && count < 2,
  });
}

/** Active categories for pickers and the browse rail (small catalogue — one page of 100). */
export function useLibraryCategories(opts?: { includeInactive?: boolean }) {
  const includeInactive = Boolean(opts?.includeInactive);
  return useQuery({
    queryKey: [...KEY, 'categories', { includeInactive }],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: '1', pageSize: '100' });
      if (includeInactive) qs.set('includeInactive', 'true');
      const res = await bffApi<Paginated<LibraryCategory>>(`/api/library/categories?${qs}`);
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useLibraryTags(q: string, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'tags', q],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: '1', pageSize: '20' });
      if (q.trim()) qs.set('q', q.trim());
      const res = await bffApi<Paginated<LibraryTag>>(`/api/library/tags?${qs}`);
      return res.data;
    },
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function fetchLibraryPreview(id: string, opts?: { retry?: boolean }) {
  return bffApi<LibraryPreview>(`/api/library/items/${id}/preview${opts?.retry ? '?retry=true' : ''}`);
}

export async function downloadLibraryItem(id: string): Promise<void> {
  const { url } = await bffApi<{ url: string }>(`/api/library/items/${id}/download`);
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ------------------------------------------------------------------ writes

function useInvalidate() {
  const qc = useQueryClient();
  return (id?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [...KEY, 'items'] }),
      qc.invalidateQueries({ queryKey: [...KEY, 'tags'] }),
      id ? qc.invalidateQueries({ queryKey: [...KEY, 'item', id] }) : Promise.resolve(),
    ]);
}

/**
 * Two-step upload: a Draft with metadata, then the file via Uppy (presign / multipart + confirm).
 * Confirming publishes the item. A failed upload leaves the Draft (`draftId`) so the dialog can
 * retry the file without creating a second item; unconfirmed drafts are swept after 24 h.
 */
export function useUploadLibraryItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      fields,
      file,
      draftId,
      onDraftCreated,
      onProgress,
    }: {
      fields: LibraryItemFields;
      file: File;
      draftId?: string | null;
      onDraftCreated?: (id: string) => void;
      onProgress?: (percent: number) => void;
    }) => {
      let id = draftId ?? null;
      if (id) {
        await bffApi<LibraryItem>(`/api/library/items/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(fields),
        });
      } else {
        const draft = await bffApi<LibraryItem>('/api/library/items', {
          method: 'POST',
          body: JSON.stringify(fields),
        });
        id = draft.id;
        onDraftCreated?.(id);
      }
      await uploadFilesWithUppy({ kind: 'library-item', parentId: id, onProgress }, [withLibraryMime(file)]);
      return bffApi<LibraryItem>(`/api/library/items/${id}`);
    },
    onSuccess: (item) => invalidate(item.id),
  });
}

export function useUpdateLibraryItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<LibraryItemFields> }) =>
      bffApi<LibraryItem>(`/api/library/items/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
    onSuccess: (item) => invalidate(item.id),
  });
}

export function useReplaceLibraryFile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      file,
      onProgress,
    }: {
      id: string;
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      await uploadFilesWithUppy({ kind: 'library-item', parentId: id, onProgress }, [withLibraryMime(file)]);
      return bffApi<LibraryItem>(`/api/library/items/${id}`);
    },
    onSuccess: (item) => invalidate(item.id),
  });
}

export function useArchiveLibraryItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      bffApi<LibraryItem>(`/api/library/items/${id}/${archive ? 'archive' : 'restore'}`, { method: 'POST' }),
    onSuccess: (item) => invalidate(item.id),
  });
}

export function useDeleteLibraryItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => bffApi<void>(`/api/library/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

// ------------------------------------------------------------------ categories (admin)

export function useLibraryCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [...KEY, 'categories'] });

  const create = useMutation({
    mutationFn: (body: { name: string; description?: string | null; sortOrder?: number }) =>
      bffApi<LibraryCategory>('/api/library/categories', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; description?: string | null; sortOrder?: number };
    }) => bffApi<LibraryCategory>(`/api/library/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      bffApi<LibraryCategory>(`/api/library/categories/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });

  return { create, update, setActive };
}
