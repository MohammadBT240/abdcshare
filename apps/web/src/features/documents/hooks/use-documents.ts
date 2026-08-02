"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { PageMeta } from "@abdcshare/api-client";
import { bffApi, bffFormData } from "@/lib/bff/client";

export type DocumentCategory = "WorkingPaper" | "FinalReport" | "Supporting";
export type DocumentStatus = "Draft" | "Ready" | "UnderReview" | "SignedOff";
export type EngagementPhase = "Planning" | "Execution" | "Reporting";
export type DocumentParticipantRole = "Auditor" | "Advisor" | "Staff";

export interface DocumentFile {
  id: string;
  version: number;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt: string;
}

export interface DocumentParticipant {
  userId: string;
  fullName: string;
  participantRole: DocumentParticipantRole;
}

export interface DocumentListItem {
  id: string;
  engagementId: string;
  requestClassId?: number | null;
  requestClassName?: string | null;
  requestId?: string | null;
  departmentId: number;
  category: DocumentCategory;
  phase?: EngagementPhase | null;
  title: string;
  description?: string | null;
  status: DocumentStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentListItem {
  files: DocumentFile[];
  participants: DocumentParticipant[];
}

export interface DocumentListResponse {
  data: DocumentListItem[];
  meta: PageMeta;
}

export interface CreateDocumentInput {
  engagementId: string;
  /** Optional for WorkingPaper; ignored for FinalReport. */
  requestClassId?: number;
  requestId?: string;
  category: Extract<DocumentCategory, "WorkingPaper" | "FinalReport">;
  phase?: EngagementPhase;
  title: string;
  description?: string;
}

const documentKeys = {
  all: ["documents"] as const,
  list: (queryString: string) => ["documents", "list", queryString] as const,
  detail: (id: string) => ["documents", "detail", id] as const,
};

async function invalidateDocuments(
  queryClient: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  await queryClient.invalidateQueries({ queryKey: documentKeys.all });
  if (id)
    await queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
}

export function useDocumentsList(queryString: string) {
  return useQuery({
    queryKey: documentKeys.list(queryString),
    queryFn: () =>
      bffApi<DocumentListResponse>(`/api/documents?${queryString}`),
    placeholderData: keepPreviousData,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => bffApi<DocumentDetail>(`/api/documents/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDocumentInput) =>
      bffApi<DocumentDetail>("/api/documents", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async (document) => {
      await invalidateDocuments(queryClient, document.id);
    },
  });
}

export function useUploadDocumentFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, file }: { documentId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return bffFormData<DocumentDetail>(
        `/api/documents/${documentId}/files/upload`,
        form,
      );
    },
    onSuccess: async (document) => {
      await invalidateDocuments(queryClient, document.id);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      bffApi<{ ok: true }>(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await invalidateDocuments(queryClient);
    },
  });
}

export function useSetDocumentStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: DocumentStatus) =>
      bffApi<DocumentDetail>(`/api/documents/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      await invalidateDocuments(queryClient, id);
    },
  });
}

export function useAddDocumentParticipant(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      userId: string;
      participantRole: DocumentParticipantRole;
    }) =>
      bffApi<DocumentDetail>(`/api/documents/${id}/participants`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await invalidateDocuments(queryClient, id);
    },
  });
}

export function useRemoveDocumentParticipant(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<DocumentDetail>(`/api/documents/${id}/participants/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidateDocuments(queryClient, id);
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (document: DocumentListItem | DocumentDetail) => {
      const detail =
        "files" in document
          ? document
          : await bffApi<DocumentDetail>(`/api/documents/${document.id}`);
      const file = detail.files[0];
      if (!file) throw new Error("No file is available for download");
      const { url } = await bffApi<{ url: string }>(
        `/api/documents/${document.id}/files/${file.id}/download`,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    },
  });
}

export function useExportDocuments() {
  return useMutation({
    mutationFn: (body: {
      engagementId: string;
      requestClassId?: number;
      category?: DocumentCategory;
    }) => bffApi<{ accepted: true; jobId: string }>('/api/documents/export', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  });
}

export function useDocumentPreview() {
  return useMutation({
    mutationFn: async ({
      documentId,
      fileId,
    }: {
      documentId: string;
      fileId: string;
    }) =>
      bffApi<{ url: string }>(
        `/api/documents/${documentId}/files/${fileId}/download`,
      ),
  });
}
