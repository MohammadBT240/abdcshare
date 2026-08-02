'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export interface DiscussionAttachment {
  id: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface DiscussionMessage {
  id: string;
  authorId: string;
  authorName?: string | null;
  parentMessageId?: string | null;
  body: string;
  mentionUserIds: string[];
  attachments: DiscussionAttachment[];
  editedAt?: string | null;
  createdAt: string;
}

export interface MessageListResponse {
  data: DiscussionMessage[];
  meta: PageMeta;
}

export interface PostMessageInput {
  requestId: string;
  body: string;
  parentMessageId?: string;
  mentionUserIds?: string[];
}

export interface EditMessageInput {
  id: string;
  body: string;
  requestId: string;
}

export interface PresignedMessageAttachment {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresIn: number;
}

export interface ConfirmMessageAttachmentInput {
  storageKey: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
}

const messageKey = (requestId: string) =>
  ['discussions', requestId, 'messages'] as const;

export function useMessages(requestId: string, enabled = true) {
  return useQuery({
    queryKey: messageKey(requestId),
    queryFn: () =>
      bffApi<MessageListResponse>(
        `/api/requests/${requestId}/messages?pageSize=100`,
      ),
    enabled: Boolean(requestId) && enabled,
  });
}

export function usePostMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, ...body }: PostMessageInput) =>
      bffApi<DiscussionMessage>(`/api/requests/${requestId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: messageKey(variables.requestId),
      });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: EditMessageInput) =>
      bffApi<DiscussionMessage>(`/api/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: messageKey(variables.requestId),
      });
    },
  });
}

export function useMarkRead() {
  return useMutation({
    mutationFn: ({
      requestId,
      lastReadMessageId,
    }: {
      requestId: string;
      lastReadMessageId?: string;
    }) =>
      bffApi<{ ok: true }>(`/api/requests/${requestId}/messages/read`, {
        method: 'POST',
        body: JSON.stringify({ lastReadMessageId }),
      }),
  });
}

export function presignMessageAttachment(
  messageId: string,
  file: Pick<File, 'name' | 'type'>,
) {
  return bffApi<PresignedMessageAttachment>(
    `/api/messages/${messageId}/attachments/presign`,
    {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      }),
    },
  );
}

export function confirmMessageAttachment(
  messageId: string,
  input: ConfirmMessageAttachmentInput,
) {
  return bffApi<DiscussionMessage>(`/api/messages/${messageId}/attachments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function uploadMessageAttachment(messageId: string, file: File) {
  const presigned = await presignMessageAttachment(messageId, file);
  const upload = await fetch(presigned.uploadUrl, {
    method: presigned.method,
    headers: presigned.headers,
    body: file,
  });
  if (!upload.ok) {
    throw new Error(`Failed to upload ${file.name}`);
  }
  return confirmMessageAttachment(messageId, {
    storageKey: presigned.storageKey,
    fileName: file.name,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
  });
}
