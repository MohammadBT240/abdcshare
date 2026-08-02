'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SubmissionStatus } from '@abdcshare/shared';
import type { PageMeta } from '@abdcshare/api-client';
import { BffClientError, bffApi } from '@/lib/bff/client';

export interface SubmissionFile {
  id: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status: SubmissionStatus;
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

interface PresignedUpload {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresIn: number;
}

function submissionsKey(requestId: string) {
  return ['requests', requestId, 'submissions'] as const;
}

export function useSubmissions(requestId: string, enabled = true) {
  return useQuery({
    queryKey: submissionsKey(requestId),
    queryFn: () =>
      bffApi<SubmissionListResponse>(
        `/api/requests/${requestId}/submissions?pageSize=100`,
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

export function useCreateSubmission(requestId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, files }: { message: string; files: File[] }) => {
      let submission = await bffApi<Submission>(
        `/api/requests/${requestId}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({ message }),
        },
      );

      for (const file of files) {
        const contentType = file.type || 'application/octet-stream';
        const presigned = await bffApi<PresignedUpload>(
          `/api/submissions/${submission.id}/files/presign`,
          {
            method: 'POST',
            body: JSON.stringify({ fileName: file.name, contentType }),
          },
        );
        const upload = await fetch(presigned.uploadUrl, {
          method: presigned.method,
          headers: presigned.headers,
          body: file,
        });
        if (!upload.ok) {
          throw new BffClientError(`Failed to upload ${file.name}`, upload.status);
        }
        submission = await bffApi<Submission>(
          `/api/submissions/${submission.id}/files`,
          {
            method: 'POST',
            body: JSON.stringify({
              storageKey: presigned.storageKey,
              fileName: file.name,
              mimeType: file.type || undefined,
              sizeBytes: file.size,
            }),
          },
        );
      }

      return submission;
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: submissionsKey(requestId) });
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
      await Promise.all([
        qc.invalidateQueries({ queryKey: submissionsKey(requestId) }),
        qc.invalidateQueries({ queryKey: ['submissions', submission.id] }),
        qc.invalidateQueries({ queryKey: ['requests', requestId] }),
      ]);
    },
  });
}
