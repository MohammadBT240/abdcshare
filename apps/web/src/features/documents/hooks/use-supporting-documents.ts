'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi, bffFormData } from '@/lib/bff/client';

export interface SupportingDocumentFile {
  id: string;
  version: number;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt: string;
}

export interface SupportingDocument {
  id: string;
  engagementId: string;
  category: 'Supporting';
  phase?: 'Planning' | 'Execution' | 'Reporting' | null;
  title: string;
  description?: string | null;
  status: string;
  currentVersion: number;
  createdAt: string;
  files?: SupportingDocumentFile[];
}

export interface SupportingDocumentList {
  data: SupportingDocument[];
  meta: PageMeta;
}

function supportingListKey(engagementId: string) {
  return ['documents', 'supporting', engagementId] as const;
}

export function useSupportingDocuments(engagementId: string) {
  const qs = new URLSearchParams({
    engagementId,
    category: 'Supporting',
    pageSize: '100',
    sort: '-createdAt',
  });
  return useQuery({
    queryKey: supportingListKey(engagementId),
    queryFn: () => bffApi<SupportingDocumentList>(`/api/documents?${qs}`),
    placeholderData: keepPreviousData,
    enabled: Boolean(engagementId),
  });
}

export function useCreateSupportingDocument(engagementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, file }: { title: string; file: File }) => {
      const created = await bffApi<SupportingDocument>('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          engagementId,
          category: 'Supporting',
          title,
          phase: 'Planning',
        }),
      });
      const form = new FormData();
      form.append('file', file);
      return bffFormData<SupportingDocument>(`/api/documents/${created.id}/files/upload`, form);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: supportingListKey(engagementId) });
    },
  });
}

export function useDeleteSupportingDocument(engagementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<void>(`/api/documents/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: supportingListKey(engagementId) });
    },
  });
}

export async function downloadSupportingDocument(doc: SupportingDocument): Promise<void> {
  const detail =
    doc.files && doc.files.length > 0
      ? doc
      : await bffApi<SupportingDocument>(`/api/documents/${doc.id}`);
  const file = detail.files?.[0];
  if (!file) throw new Error('No file attached');
  const { url } = await bffApi<{ url: string }>(
    `/api/documents/${doc.id}/files/${file.id}/download`,
  );
  window.open(url, '_blank', 'noopener,noreferrer');
}
