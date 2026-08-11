'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';
import { uploadFilesWithUppy } from '@/lib/uploads/uppy-client';

export interface CompanyProfileRecord {
  id: string;
  name: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  isActive: boolean;
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfileListResponse {
  data: CompanyProfileRecord[];
  meta: PageMeta;
}

export function useCompanyProfilesList(queryString: string) {
  return useQuery({
    queryKey: ['company-profiles', 'list', queryString],
    queryFn: () => bffApi<CompanyProfileListResponse>(`/api/company-profiles?${queryString}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCompanyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      file,
      onProgress,
    }: {
      name: string;
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      const draft = await bffApi<CompanyProfileRecord>('/api/company-profiles', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      try {
        await uploadFilesWithUppy(
          { kind: 'company-profile', parentId: draft.id, onProgress },
          [file],
        );
      } catch (err) {
        await bffApi<void>(`/api/company-profiles/${draft.id}`, { method: 'DELETE' }).catch(
          () => undefined,
        );
        throw err;
      }
      return bffApi<CompanyProfileRecord>(`/api/company-profiles/${draft.id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company-profiles'] });
    },
  });
}

export function useRenameCompanyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      bffApi<CompanyProfileRecord>(`/api/company-profiles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company-profiles'] });
    },
  });
}

export function useReplaceCompanyProfileFile() {
  const qc = useQueryClient();
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
      await uploadFilesWithUppy(
        { kind: 'company-profile', parentId: id, onProgress },
        [file],
      );
      return bffApi<CompanyProfileRecord>(`/api/company-profiles/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company-profiles'] });
    },
  });
}

export function useDeleteCompanyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      bffApi<void>(`/api/company-profiles/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company-profiles'] });
    },
  });
}

export async function downloadCompanyProfile(id: string): Promise<void> {
  const { url } = await bffApi<{ url: string }>(`/api/company-profiles/${id}/download`);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function fetchCompanyProfilePreview(id: string) {
  return bffApi<{
    url: string | null;
    mode: 'native' | 'converted' | 'unavailable';
    previewStatus: string;
    reason?: 'pending' | 'failed' | 'unsupported';
  }>(`/api/company-profiles/${id}/preview`);
}
