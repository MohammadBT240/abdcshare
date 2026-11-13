'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import { uploadFilesWithUppy } from '@/lib/uploads/uppy-client';
import { withLibraryMime } from '@/features/library/lib/library-files';
import type {
  LibraryAttention,
  LibraryDuplicate,
  LibraryDuplicateGroup,
  LibraryCategory,
  LibraryEventPage,
  LibraryItem,
  LibraryItemFields,
  LibraryPreview,
  LibraryReportEntry,
  LibraryReportGroup,
  LibraryReportOutcome,
  LibraryReportReason,
  LibraryReportStatus,
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
    // Poll while the virus check runs so Download appears on its own (usually seconds).
    refetchInterval: (q) => ((q.state.data as LibraryItem | undefined)?.scanStatus === 'Pending' ? 3000 : false),
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

/** Departments for access pickers and the filter (`/library/departments` — staff can't list `/departments`). */
export function useLibraryDepartments() {
  return useQuery({
    queryKey: ['library', 'departments'],
    queryFn: () => bffApi<{ id: number; name: string; isActive: boolean }[]>('/api/library/departments'),
    staleTime: 5 * 60_000,
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

/** Activity timeline (uploader + curators), newest first. */
export function useLibraryItemEvents(id: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'item', id, 'events'],
    queryFn: ({ pageParam }) =>
      bffApi<LibraryEventPage>(
        `/api/library/items/${id}/events?limit=30${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(id) && enabled,
  });
}

export function useLibraryItemEventSummary(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'item', id, 'events', 'summary'],
    queryFn: () => bffApi<{ counts: Record<string, number> }>(`/api/library/items/${id}/events/summary`),
    enabled: Boolean(id) && enabled,
  });
}

/** Curator queue badge: items with open reports (0 for non-curators). */
export function useLibraryReportCount(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'reports', 'count'],
    queryFn: () => bffApi<{ open: number }>('/api/library/reports/count'),
    enabled,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useLibraryReports(status: LibraryReportStatus, page: number) {
  return useQuery({
    queryKey: [...KEY, 'reports', status, page],
    queryFn: () =>
      bffApi<Paginated<LibraryReportGroup>>(`/api/library/reports?status=${status}&page=${page}&pageSize=20`),
    placeholderData: keepPreviousData,
  });
}

export function useReportLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, note }: { id: string; reason: LibraryReportReason; note?: string | null }) =>
      bffApi<LibraryReportEntry>(`/api/library/items/${id}/reports`, {
        method: 'POST',
        body: JSON.stringify({ reason, note: note || null }),
      }),
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: [...KEY, 'item', vars.id] }),
  });
}

export function useResolveLibraryReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reportId,
      outcome,
      departmentIds,
      note,
    }: {
      reportId: string;
      outcome: LibraryReportOutcome;
      departmentIds?: number[];
      note?: string | null;
    }) =>
      bffApi<{ resolved: number; outcome: LibraryReportOutcome }>(`/api/library/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ outcome, departmentIds, note: note || null }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY] }),
  });
}

/** SHA-256 of a file in the browser (D27). Large files take a moment; callers show progress. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fetchLibraryDuplicates(hash: string) {
  return bffApi<LibraryDuplicate[]>(`/api/library/items/duplicates?hash=${hash}`);
}

export function useLibraryAttention(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'admin', 'attention'],
    queryFn: () => bffApi<LibraryAttention>('/api/library/admin/attention'),
    enabled,
  });
}

export function useLibraryDuplicateGroups(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'admin', 'duplicates'],
    queryFn: () => bffApi<LibraryDuplicateGroup[]>('/api/library/admin/duplicates'),
    enabled,
  });
}

export function fetchDepartmentLibraryImpact(departmentId: number) {
  return bffApi<{ items: number; collections: number }>(`/api/library/admin/departments/${departmentId}/impact`);
}

export function useTransferLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      args:
        | { kind: 'item' | 'collection'; id: string; userId: string }
        | { kind: 'all'; fromUserId: string; toUserId: string },
    ) =>
      args.kind === 'all'
        ? bffApi<{ items: number; collections: number }>('/api/library/admin/transfer-all', {
            method: 'POST',
            body: JSON.stringify({ fromUserId: args.fromUserId, toUserId: args.toUserId }),
          })
        : bffApi<{ items: number; collections: number }>(
            `/api/library/admin/${args.kind === 'item' ? 'items' : 'collections'}/${args.id}/transfer`,
            { method: 'POST', body: JSON.stringify({ userId: args.userId }) },
          ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY] }),
  });
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
export interface UploadLibraryFileArgs {
  fields: LibraryItemFields;
  file: File;
  draftId?: string | null;
  onDraftCreated?: (id: string) => void;
  onProgress?: (percent: number) => void;
  /** The uploader ticked the upload declaration (D18) — the API refuses uploads without it. */
  declared: true;
}

/** Draft (or reuse a draft) → Uppy upload → confirm. Used by single and bulk upload. */
export async function uploadLibraryFile({ fields, file, draftId, onDraftCreated, onProgress, declared }: UploadLibraryFileArgs) {
  let id = draftId ?? null;
  if (id) {
    // Retry of a failed upload: refresh metadata, but never re-send the collection link.
    const { collectionId: _c, section: _s, ...rest } = fields;
    await bffApi<LibraryItem>(`/api/library/items/${id}`, { method: 'PATCH', body: JSON.stringify(rest) });
  } else {
    const draft = await bffApi<LibraryItem>('/api/library/items', {
      method: 'POST',
      body: JSON.stringify({ ...fields, declaration: declared }),
    });
    id = draft.id;
    onDraftCreated?.(id);
  }
  await uploadFilesWithUppy(
    { kind: 'library-item', parentId: id, onProgress, confirmExtra: { declaration: declared } },
    [withLibraryMime(file)],
  );
  return bffApi<LibraryItem>(`/api/library/items/${id}`);
}

/**
 * Two-step upload: a Draft with metadata, then the file via Uppy (presign / multipart + confirm).
 * Confirming publishes the item. A failed upload leaves the Draft (`draftId`) so the dialog can
 * retry the file without creating a second item; unconfirmed drafts are swept after 24 h.
 */
export function useUploadLibraryItem() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadLibraryFile,
    onSuccess: async (item) => {
      await invalidate(item.id);
      await qc.invalidateQueries({ queryKey: [...KEY, 'collection'] });
      await qc.invalidateQueries({ queryKey: [...KEY, 'collections'] });
    },
  });
}

/** Invalidate library lists after a batch of uploads (bulk dialog). */
export function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...KEY] });
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
      declared,
    }: {
      id: string;
      file: File;
      onProgress?: (percent: number) => void;
      declared: true;
    }) => {
      await uploadFilesWithUppy(
        { kind: 'library-item', parentId: id, onProgress, confirmExtra: { declaration: declared } },
        [withLibraryMime(file)],
      );
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
