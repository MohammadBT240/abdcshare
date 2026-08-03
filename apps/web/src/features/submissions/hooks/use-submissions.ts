'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SubmissionStatus } from '@abdcshare/shared';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';
import { uploadFilesWithUppy } from '@/lib/uploads/uppy-client';

export interface SubmissionFile {
  id: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status: SubmissionStatus;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  replacesFileId?: string | null;
  superseded: boolean;
}

export interface Submission {
  id: string;
  requestId: string;
  submittedById: string;
  submittedByName?: string | null;
  message: string;
  status: SubmissionStatus;
  reviewedById?: string | null;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  files: SubmissionFile[];
  createdAt: string;
}

export interface SubmissionListResponse {
  data: Submission[];
  meta: PageMeta;
}

function submissionsKeyRoot(requestId: string) {
  return ['requests', requestId, 'submissions'] as const;
}

function submissionsKey(requestId: string, params?: { page?: number; pageSize?: number }) {
  return [
    ...submissionsKeyRoot(requestId),
    params?.page ?? 1,
    params?.pageSize ?? 100,
  ] as const;
}

async function invalidateSubmissionQueries(
  qc: ReturnType<typeof useQueryClient>,
  requestId: string,
  submissionId?: string,
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: submissionsKeyRoot(requestId) }),
    submissionId
      ? qc.invalidateQueries({ queryKey: ['submissions', submissionId] })
      : Promise.resolve(),
    qc.invalidateQueries({ queryKey: ['requests', requestId] }),
  ]);
}

export function useSubmissions(
  requestId: string,
  enabled = true,
  params?: { page?: number; pageSize?: number },
) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 100;
  return useQuery({
    queryKey: submissionsKey(requestId, { page, pageSize }),
    queryFn: () =>
      bffApi<SubmissionListResponse>(
        `/api/requests/${requestId}/submissions?page=${page}&pageSize=${pageSize}`,
      ),
    placeholderData: keepPreviousData,
    enabled: Boolean(requestId) && enabled,
  });
}

export function useSubmission(id: string, enabled = true) {
  return useQuery({
    queryKey: ['submissions', id],
    queryFn: () => bffApi<Submission>(`/api/submissions/${id}`),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateDraftSubmission(requestId: string) {
  return useMutation({
    mutationFn: (message: string) =>
      bffApi<Submission>(`/api/requests/${requestId}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
  });
}

export function useFinalizeSubmission(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) =>
      bffApi<Submission>(`/api/submissions/${submissionId}/finalize`, { method: 'POST' }),
    onSettled: async (_data, _err, submissionId) => {
      await invalidateSubmissionQueries(qc, requestId, submissionId);
    },
  });
}

export function useDiscardDraft(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) =>
      bffApi(`/api/submissions/${submissionId}`, { method: 'DELETE' }),
    onSettled: async () => {
      await invalidateSubmissionQueries(qc, requestId);
    },
  });
}

/** Legacy one-shot create (kept for callers that don't need per-file retry). */
export function useCreateSubmission(requestId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      message,
      files,
      onProgress,
    }: {
      message: string;
      files: File[];
      onProgress?: (percent: number) => void;
    }) => {
      const draft = await bffApi<Submission>(`/api/requests/${requestId}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });

      try {
        await uploadFilesWithUppy(
          { kind: 'submission', parentId: draft.id, onProgress },
          files,
        );
        return await bffApi<Submission>(`/api/submissions/${draft.id}/finalize`, {
          method: 'POST',
        });
      } catch (err) {
        try {
          await bffApi(`/api/submissions/${draft.id}`, { method: 'DELETE' });
        } catch {
          // ignore
        }
        throw err;
      }
    },
    onSettled: async () => {
      await invalidateSubmissionQueries(qc, requestId);
    },
  });
}

export function useReviewSubmission(requestId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      submissionId,
      decision,
      reason,
    }: {
      submissionId: string;
      decision: SubmissionStatus.Accepted | SubmissionStatus.Returned;
      reason?: string;
    }) =>
      bffApi<Submission>(`/api/submissions/${submissionId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      }),
    onSuccess: async (submission) => {
      await invalidateSubmissionQueries(qc, requestId, submission.id);
    },
  });
}

export function useReviewSubmissionFile(requestId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      submissionId,
      fileId,
      decision,
      reason,
    }: {
      submissionId: string;
      fileId: string;
      decision: SubmissionStatus.Accepted | SubmissionStatus.Returned;
      reason?: string;
    }) =>
      bffApi<Submission>(`/api/submissions/${submissionId}/files/${fileId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      }),
    onSuccess: async (submission) => {
      await invalidateSubmissionQueries(qc, requestId, submission.id);
    },
  });
}

/** Reopen an Accepted file for revision (Accepted → Returned with reason). */
export function useReopenSubmissionFile(requestId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      submissionId,
      fileId,
      reason,
    }: {
      submissionId: string;
      fileId: string;
      reason: string;
    }) =>
      bffApi<Submission>(`/api/submissions/${submissionId}/files/${fileId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async (submission) => {
      await invalidateSubmissionQueries(qc, requestId, submission.id);
    },
  });
}

export type SubmissionFilePreview = {
  url: string | null;
  mode: 'native' | 'converted' | 'unavailable';
  previewStatus: string;
  reason?: 'pending' | 'failed' | 'unsupported';
};

export async function fetchSubmissionFileDownload(submissionId: string, fileId: string) {
  return bffApi<{ url: string }>(`/api/submissions/${submissionId}/files/${fileId}/download`);
}

export async function fetchSubmissionFilePreview(
  submissionId: string,
  fileId: string,
  opts?: { retryFailed?: boolean },
) {
  const qs = opts?.retryFailed ? '?retryFailed=1' : '';
  return bffApi<SubmissionFilePreview>(
    `/api/submissions/${submissionId}/files/${fileId}/preview${qs}`,
  );
}

export async function fetchSubmissionZipEntries(submissionId: string, fileId: string) {
  return bffApi<{ entries: Array<{ name: string; size: number; isDirectory: boolean }> }>(
    `/api/submissions/${submissionId}/files/${fileId}/zip-entries`,
  );
}

export async function fetchSubmissionZipEntry(
  submissionId: string,
  fileId: string,
  entryPath: string,
) {
  const qs = new URLSearchParams({ path: entryPath });
  return bffApi<{ url: string; fileName: string; mimeType: string }>(
    `/api/submissions/${submissionId}/files/${fileId}/zip-entry?${qs}`,
  );
}

export async function openSubmissionFileDownload(submissionId: string, fileId: string) {
  const { url } = await fetchSubmissionFileDownload(submissionId, fileId);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Queue a worker zip of all current files; ready via in-app notification. */
export async function requestSubmissionExport(submissionId: string) {
  return bffApi<{ accepted: true; jobId: string }>(`/api/submissions/${submissionId}/export`, {
    method: 'POST',
  });
}

/** Upload a replacement for a Returned file on an existing submission. */
export function useReplaceSubmissionFile(requestId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      replacesFileId,
      file,
      onProgress,
    }: {
      submissionId: string;
      replacesFileId: string;
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      await uploadFilesWithUppy(
        {
          kind: 'submission',
          parentId: submissionId,
          onProgress,
          replacesFileId,
        },
        [file],
      );
      return bffApi<Submission>(`/api/submissions/${submissionId}`);
    },
    onSuccess: async (submission) => {
      await invalidateSubmissionQueries(qc, requestId, submission.id);
    },
  });
}
