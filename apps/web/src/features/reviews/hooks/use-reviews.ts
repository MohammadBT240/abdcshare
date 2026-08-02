'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export type ReviewStatus = 'ForReview' | 'Approved' | 'SentBack';
export type ReviewDecision = Extract<ReviewStatus, 'Approved' | 'SentBack'>;

export interface Review {
  id: string;
  requestId?: string | null;
  documentId?: string | null;
  preparerId: string;
  preparerName?: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
  status: ReviewStatus;
  notes?: string | null;
  submittedAt: string;
  decidedAt?: string | null;
}

export interface ReviewListResponse {
  data: Review[];
  meta: PageMeta;
}

const reviewKeys = {
  all: ['reviews'] as const,
  list: (query: string) => ['reviews', 'list', query] as const,
};

export function useReviewsList(query: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.list(query),
    queryFn: () => bffApi<ReviewListResponse>(`/api/reviews?${query}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      requestId?: string;
      documentId?: string;
      reviewerId: string;
      notes?: string;
    }) =>
      bffApi<Review>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });
}

export function useDecideReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; decision: ReviewDecision; notes?: string }) =>
      bffApi<Review>(`/api/reviews/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });
}
