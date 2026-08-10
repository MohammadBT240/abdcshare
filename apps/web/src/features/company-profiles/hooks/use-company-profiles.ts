'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi, bffFormData } from '@/lib/bff/client';

export interface CompanyProfileRecord {
  id: string;
  name: string;
  fileName: string;
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
    mutationFn: ({ name, file }: { name: string; file: File }) => {
      const form = new FormData();
      form.append('name', name);
      form.append('file', file);
      return bffFormData<CompanyProfileRecord>('/api/company-profiles', form);
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
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return bffFormData<CompanyProfileRecord>(`/api/company-profiles/${id}/file`, form);
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
