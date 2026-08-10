"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  IconArrowRight,
  IconDownload,
  IconEye,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data/data-table";
import { StatusPill, formatStatusLabel, resolveStatusTone } from "@/components/data";
import { FileTypeIcon } from "@/components/data/file-type-icon";
import {
  AppSelect,
  ATTACHMENT_ACCEPT,
  ConfirmDialog,
  FileUpload,
  FormDialog,
  FormField,
  LoadingButton,
  UPLOAD_MAX_BYTES,
  formatMaxBytesLabel,
} from "@/components/forms";
import { MULTIPART_THRESHOLD_BYTES } from "@/lib/uploads/uppy-client";
import { FileViewerDialog } from "@/components/files/file-viewer-dialog";
import { useAuthContext } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type DocumentCategory,
  type DocumentDetail,
  type DocumentListItem,
  type DocumentStatus,
  type ReportReviewState,
  useCreateDocument,
  useDeleteDocument,
  useDocument,
  useDocumentsList,
  useDownloadDocument,
  useExportDocuments,
  fetchDocumentFilePreview,
  fetchDocumentZipEntries,
  fetchDocumentZipEntry,
  openDocumentFileDownload,
  useSetDocumentStatus,
  useUploadDocumentFile,
} from "@/features/documents/hooks/use-documents";
import type { EngagementWorkspace } from "@/features/engagements/hooks/use-engagements";
import {
  type ReportReviewStatus,
  sendFinalReportToClient,
  useFirmReportReview,
  useOverrideFinalReport,
  useSendFinalReport,
} from "@/features/report-reviews/hooks/use-report-reviews";
import { useRequestsList } from "@/features/requests/hooks/use-requests";
import { BffClientError } from "@/lib/bff/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<
  Extract<DocumentCategory, "WorkingPaper" | "FinalReport">,
  string
> = {
  WorkingPaper: "Working papers",
  FinalReport: "Final reports",
};

const NEXT_STATUS: Partial<Record<DocumentStatus, DocumentStatus>> = {
  Draft: "Ready",
  Ready: "UnderReview",
  UnderReview: "SignedOff",
};

function parseCategory(
  value: string | null,
): Extract<DocumentCategory, "WorkingPaper" | "FinalReport"> {
  return value === "FinalReport" ? "FinalReport" : "WorkingPaper";
}

function formatStatus(status: DocumentStatus): string {
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function firmClientReviewLabel(state?: ReportReviewState | null): string {
  switch (state) {
    case "AwaitingClient":
      return "Awaiting client";
    case "ChangesRequested":
      return "Changes requested";
    case "Locked":
      return "Locked";
    case "Approved":
      return "Approved";
    case "Overridden":
      return "Issued";
    case "NotSent":
      return "Not sent";
    default:
      return state ? formatStatusLabel(state) : "—";
  }
}

function formatWhen(iso?: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface DocumentsTabProps {
  engagementId: string;
  workspace: EngagementWorkspace;
}

export function DocumentsTab({ engagementId, workspace }: DocumentsTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useAuthContext();
  const category = parseCategory(searchParams.get("category"));
  const classId = searchParams.get("classId") ?? "";
  const requestId = searchParams.get("requestId") ?? "";
  const documentIdParam = searchParams.get("documentId") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(documentIdParam);
  const exportDocuments = useExportDocuments();

  useEffect(() => {
    if (documentIdParam) setSelectedId(documentIdParam);
  }, [documentIdParam]);

  const listQuery = useMemo(() => {
    const query = new URLSearchParams({
      engagementId,
      category,
      page: String(page),
      pageSize: "50",
    });
    if (category === "WorkingPaper" && classId) {
      query.set("requestClassId", classId);
    }
    if (category === "WorkingPaper" && requestId) {
      query.set("requestId", requestId);
    }
    return query.toString();
  }, [category, classId, engagementId, page, requestId]);
  const documents = useDocumentsList(listQuery);

  const canUpload =
    category === "WorkingPaper"
      ? can("working-paper:upload")
      : can("final-report:upload");

  async function requestExport() {
    try {
      await exportDocuments.mutateAsync({
        engagementId,
        requestClassId:
          category === "WorkingPaper" && classId
            ? Number(classId)
            : undefined,
        category,
      });
      toast.success("Export queued. You will be notified when the ZIP is ready.");
    } catch (error) {
      toast.error(
        error instanceof BffClientError ? error.message : "Failed to queue export",
      );
    }
  }

  function setQuery(patch: {
    category?: Extract<DocumentCategory, "WorkingPaper" | "FinalReport">;
    classId?: string;
    requestId?: string | null;
    page?: number;
  }) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "documents");
    if (patch.category) next.set("category", patch.category);
    if (patch.classId !== undefined) {
      if (patch.classId && patch.classId !== "all") next.set("classId", patch.classId);
      else next.delete("classId");
    }
    if (patch.requestId !== undefined) {
      if (patch.requestId) next.set("requestId", patch.requestId);
      else next.delete("requestId");
    }
    if (patch.page !== undefined && patch.page > 1)
      next.set("page", String(patch.page));
    else if (patch.page !== undefined) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    setSelectedId("");
  }

  const columns = useMemo<ColumnDef<DocumentListItem, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <FileTypeIcon kind="folder" size={18} />
            <span className="truncate">{row.original.title}</span>
          </span>
        ),
      },
      ...(category === "WorkingPaper"
        ? [
            {
              accessorKey: "requestClassName",
              header: "Class",
              cell: ({ row }) => row.original.requestClassName || "—",
            } satisfies ColumnDef<DocumentListItem, unknown>,
          ]
        : []),
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusPill tone={resolveStatusTone(row.original.status)}>
            {formatStatusLabel(row.original.status)}
          </StatusPill>
        ),
      },
      ...(category === "FinalReport"
        ? [
            {
              id: "clientReview",
              header: "Client review",
              cell: ({ row }) => (
                <StatusPill
                  tone={resolveStatusTone(
                    row.original.clientReviewState ?? "NotSent",
                  )}
                >
                  {firmClientReviewLabel(row.original.clientReviewState)}
                </StatusPill>
              ),
            } satisfies ColumnDef<DocumentListItem, unknown>,
          ]
        : []),
      {
        accessorKey: "phase",
        header: "Phase",
        cell: ({ row }) => row.original.phase || "—",
      },
      {
        accessorKey: "currentVersion",
        header: "Version",
        cell: ({ row }) => `v${row.original.currentVersion}`,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
      },
    ],
    [category],
  );

  const classOptions = workspace.classRollups.map((item) => ({
    value: String(item.requestClassId),
    label: item.name,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={category}
          onValueChange={(value) => {
            const next = parseCategory(value);
            setQuery({
              category: next,
              classId: next === "FinalReport" ? "" : undefined,
              page: 1,
            });
          }}
        >
          <TabsList>
            <TabsTrigger value="WorkingPaper">Working papers</TabsTrigger>
            <TabsTrigger value="FinalReport">Final reports</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportDocuments.isPending}
            onClick={requestExport}
          >
            <FileTypeIcon fileName="export.zip" size={16} className="mr-1.5" />
            {exportDocuments.isPending ? "Queueing…" : "Export ZIP"}
          </Button>
          {canUpload ? (
            <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
              <FileTypeIcon kind="upload" size={16} className="mr-1.5" />
              Upload
            </Button>
          ) : null}
        </div>
      </div>

      {category === "WorkingPaper" ? (
        <div className="w-full sm:max-w-xs">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Request class
          </p>
          <AppSelect
            value={classId}
            onValueChange={(value) => setQuery({ classId: value, page: 1 })}
            options={classOptions}
            allowNone
            noneLabel="All classes"
            noneValue="all"
            placeholder="All classes"
          />
        </div>
      ) : null}

      {requestId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Filtered to documents linked to one request.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQuery({ requestId: null, page: 1 })}
          >
            Clear request filter
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={documents.data?.data ?? []}
        meta={documents.data?.meta}
        isPending={documents.isPending || documents.isFetching}
        error={documents.isError ? "Failed to load documents" : null}
        onPageChange={(nextPage) => setQuery({ page: nextPage })}
        onRowClick={(document) => setSelectedId(document.id)}
        emptyMessage={`No ${CATEGORY_LABELS[category].toLowerCase()} found`}
      />

      {selectedId ? (
        <DocumentDetailPanel
          id={selectedId}
          canDelete={can("document:delete")}
          canSignOff={can("review:signoff")}
          canManageWorkingPapers={can("working-paper:upload")}
          canManageFinalReports={can("final-report:upload")}
          canManageReportReview={can("report-review:manage")}
          onClose={() => setSelectedId("")}
        />
      ) : null}

      {uploadOpen ? (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          engagementId={engagementId}
          category={category}
          classId={classId}
          classOptions={classOptions}
        />
      ) : null}
    </div>
  );
}


function formatUploadBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUploadSpeed(bytesPerSecond: number | null): string | null {
  if (bytesPerSecond == null || bytesPerSecond <= 0) return null;
  if (bytesPerSecond < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

type DocumentUploadProgress = {
  percent: number;
  bytesUploaded: number;
  bytesTotal: number;
  speedBps: number | null;
};

function UploadDocumentDialog({
  open,
  onOpenChange,
  engagementId,
  category,
  classId,
  classOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  category: Extract<DocumentCategory, "WorkingPaper" | "FinalReport">;
  classId: string;
  classOptions: Array<{ value: string; label: string }>;
}) {
  const createDocument = useCreateDocument();
  const uploadFile = useUploadDocumentFile();
  const queryClient = useQueryClient();
  const requests = useRequestsList(`engagementId=${engagementId}&pageSize=100`);
  const isWorkingPaper = category === "WorkingPaper";
  const [selectedClassId, setSelectedClassId] = useState(
    isWorkingPaper ? classId : "",
  );
  const [requestId, setRequestId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] =
    useState<DocumentUploadProgress | null>(null);
  const [sendingToClient, setSendingToClient] = useState(false);
  const speedSampleRef = useRef<{ t: number; bytes: number } | null>(null);

  const requestOptions = useMemo(
    () =>
      (requests.data?.data ?? [])
        .filter(
          (request) =>
            !selectedClassId ||
            String(request.requestClassId) === selectedClassId,
        )
        .map((request) => ({
          value: request.id,
          label: `${request.referenceCode} · ${request.requestTypeName}`,
        })),
    [requests.data, selectedClassId],
  );
  const saving =
    createDocument.isPending || uploadFile.isPending || sendingToClient;
  const maxLabel = formatMaxBytesLabel(UPLOAD_MAX_BYTES);
  const speedLabel = uploadProgress
    ? formatUploadSpeed(uploadProgress.speedBps)
    : null;

  async function submit() {
    if (!title.trim()) {
      toast.error("Enter a title");
      return;
    }
    const file = files[0];
    if (!file) {
      toast.error("Select a file");
      return;
    }

    try {
      speedSampleRef.current = null;
      setUploadProgress({
        percent: 0,
        bytesUploaded: 0,
        bytesTotal: file.size,
        speedBps: null,
      });
      const created = await createDocument.mutateAsync({
        engagementId,
        category,
        requestClassId:
          isWorkingPaper && selectedClassId
            ? Number(selectedClassId)
            : undefined,
        requestId: isWorkingPaper && requestId ? requestId : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      await uploadFile.mutateAsync({
        documentId: created.id,
        file,
        onBytesProgress: ({ percent, bytesUploaded, bytesTotal }) => {
          const now = performance.now();
          const prev = speedSampleRef.current;
          let nextSpeed: number | null | undefined;
          if (prev) {
            const dt = (now - prev.t) / 1000;
            if (dt >= 0.35) {
              nextSpeed = Math.max(0, (bytesUploaded - prev.bytes) / dt);
              speedSampleRef.current = { t: now, bytes: bytesUploaded };
            }
          } else {
            speedSampleRef.current = { t: now, bytes: bytesUploaded };
          }
          setUploadProgress((current) => ({
            percent,
            bytesUploaded,
            bytesTotal,
            speedBps:
              nextSpeed !== undefined
                ? nextSpeed
                : (current?.speedBps ?? null),
          }));
        },
      });
      if (!isWorkingPaper) {
        setSendingToClient(true);
        try {
          await sendFinalReportToClient(created.id);
          await queryClient.invalidateQueries({ queryKey: ["report-reviews"] });
          await queryClient.invalidateQueries({
            queryKey: ["documents", "detail", created.id],
          });
          toast.success("Final report uploaded and sent to the client");
        } catch (sendError) {
          toast.error(
            sendError instanceof BffClientError
              ? `Uploaded, but failed to send: ${sendError.message}`
              : "Uploaded, but failed to send to the client",
          );
          onOpenChange(false);
          return;
        } finally {
          setSendingToClient(false);
        }
      } else {
        toast.success("Working paper uploaded");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to upload document",
      );
    } finally {
      speedSampleRef.current = null;
      setUploadProgress(null);
      setSendingToClient(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isWorkingPaper ? "Upload working paper" : "Upload final report"}
      description={
        isWorkingPaper
          ? "Engagement-scoped. Request class and request link are optional."
          : "Uploads the file and sends it to the client for review automatically. Super Admin only."
      }
      maxWidthClass="sm:max-w-2xl"
      footer={
        <LoadingButton type="button" loading={saving} onClick={submit}>
          {isWorkingPaper ? "Upload" : "Upload & send"}
        </LoadingButton>
      }
    >
      <div className="space-y-4">
        {isWorkingPaper ? (
          <>
            <FormField label="Request class">
              <AppSelect
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setRequestId("");
                }}
                options={classOptions}
                allowNone
                noneLabel="No class"
                noneValue="none"
                placeholder="No class"
              />
            </FormField>
            <FormField label="Request">
              <AppSelect
                value={requestId}
                onValueChange={setRequestId}
                options={requestOptions}
                allowNone
                noneLabel="No linked request"
                noneValue="none"
                placeholder="No linked request"
                isLoading={requests.isPending}
              />
            </FormField>
          </>
        ) : null}
        <FormField label="Title" required>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>
        <FormField label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </FormField>
        <FormField label="File" required>
          <FileUpload
            files={files}
            onChange={(nextFiles) => {
              setFiles(nextFiles);
              if (!title && nextFiles[0]) {
                setTitle(nextFiles[0].name.replace(/\.[^.]+$/, ""));
              }
            }}
            accept={ATTACHMENT_ACCEPT}
            maxBytes={UPLOAD_MAX_BYTES}
            label="Choose document"
            description={`PDF, Office, images, video, zip, and more — one file up to ${maxLabel}. Large files upload in chunks with retries.`}
            disabled={saving}
          />
        </FormField>
        {uploadProgress != null && files[0] ? (
          <div className="space-y-1.5 rounded-md border border-border bg-muted/20 px-3 py-2">
            <div className="flex justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium">{files[0].name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {uploadProgress.percent}%
                {speedLabel ? ` · ${speedLabel}` : ""}
                {uploadProgress.bytesTotal > MULTIPART_THRESHOLD_BYTES
                  ? " · multipart"
                  : ""}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatUploadBytes(uploadProgress.bytesUploaded)}
              {" / "}
              {formatUploadBytes(uploadProgress.bytesTotal)}
              {uploadProgress.bytesTotal > MULTIPART_THRESHOLD_BYTES
                ? " — large file, uploading in chunks"
                : null}
            </p>
          </div>
        ) : null}
      </div>
    </FormDialog>
  );
}

function DocumentDetailPanel({
  id,
  canDelete,
  canSignOff,
  canManageWorkingPapers,
  canManageFinalReports,
  canManageReportReview,
  onClose,
}: {
  id: string;
  canDelete: boolean;
  canSignOff: boolean;
  canManageWorkingPapers: boolean;
  canManageFinalReports: boolean;
  canManageReportReview: boolean;
  onClose: () => void;
}) {
  const document = useDocument(id);
  const download = useDownloadDocument();
  const setStatus = useSetDocumentStatus(id);
  const remove = useDeleteDocument();
  const reportReview = useFirmReportReview(
    id,
    canManageReportReview && document.data?.category === "FinalReport",
  );
  const sendReport = useSendFinalReport(id);
  const overrideReport = useOverrideFinalReport(id);
  const uploadRevision = useUploadDocumentFile();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionFiles, setRevisionFiles] = useState<File[]>([]);
  const [revisionProgress, setRevisionProgress] = useState<{
    percent: number;
    bytesUploaded: number;
    bytesTotal: number;
    speedBps: number | null;
  } | null>(null);
  const revisionSpeedRef = useRef<{ t: number; bytes: number } | null>(null);

  if (document.isPending) {
    return (
      <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Loading document…
      </p>
    );
  }
  if (document.isError || !document.data) {
    return (
      <p className="rounded-lg border border-border p-4 text-sm text-destructive">
        Failed to load document
      </p>
    );
  }

  const detail: DocumentDetail = document.data;
  const nextStatus = NEXT_STATUS[detail.status];
  const canManage =
    detail.category === "WorkingPaper"
      ? canManageWorkingPapers
      : canManageFinalReports;
  const canTransition = Boolean(
    nextStatus && canManage && (nextStatus !== "SignedOff" || canSignOff),
  );
  const latestFile = detail.files[0];
  const isZip =
    latestFile?.mimeType === "application/zip" ||
    latestFile?.mimeType === "application/x-zip-compressed" ||
    Boolean(latestFile?.fileName?.toLowerCase().endsWith(".zip"));
  const review: ReportReviewStatus | undefined = reportReview.data;
  const lastCycle = review?.cycles.at(-1);
  const latestFeedback = [...(review?.cycles ?? [])]
    .reverse()
    .find((c) => c.feedback && c.decision === "ChangesRequested")?.feedback;
  const needsNewerVersion =
    review?.reviewState === "ChangesRequested" &&
    Boolean(lastCycle) &&
    detail.currentVersion <= (lastCycle?.fileVersion ?? 0);
  const canUploadRevision =
    detail.category === "FinalReport" &&
    canManageFinalReports &&
    Boolean(review) &&
    ["NotSent", "ChangesRequested"].includes(review!.reviewState);
  /** Recovery if file uploaded but send failed before a cycle was created. */
  const showSendRecovery =
    detail.category === "FinalReport" &&
    canManageReportReview &&
    review?.reviewState === "NotSent" &&
    detail.currentVersion >= 1;

  async function transitionStatus() {
    if (!nextStatus) return;
    try {
      await setStatus.mutateAsync(nextStatus);
      toast.success(`Document moved to ${formatStatus(nextStatus)}`);
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to update status",
      );
    }
  }

  async function deleteDocument() {
    try {
      await remove.mutateAsync(detail.id);
      toast.success("Document deleted");
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to delete document",
      );
    }
  }

  async function sendToClient() {
    try {
      await sendReport.mutateAsync();
      toast.success("Final report sent to the client");
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to send final report",
      );
    }
  }

  async function overrideLockedReport() {
    if (!overrideReason.trim()) {
      toast.error("Enter an override reason");
      return;
    }
    try {
      await overrideReport.mutateAsync(overrideReason.trim());
      toast.success("Locked final report overridden");
      setOverrideOpen(false);
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to override final report",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!left-auto !right-0 !top-0 !block h-dvh w-full !max-w-3xl !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none p-0">
        <section className="bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Document detail
              </p>
              <DialogTitle className="flex items-center gap-2 truncate text-lg font-semibold">
                <FileTypeIcon
                  fileName={detail.files[0]?.fileName}
                  mimeType={detail.files[0]?.mimeType}
                  kind={detail.files[0] ? undefined : "folder"}
                  size={22}
                />
                <span className="min-w-0 truncate">{detail.title}</span>
              </DialogTitle>
              <DialogDescription>
                {detail.requestClassName || "No class"} · v
                {detail.currentVersion}
                {detail.files[0]?.fileName
                  ? ` · ${detail.files[0].fileName}`
                  : ""}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={download.isPending || detail.files.length === 0}
                onClick={() =>
                  download.mutate(detail, {
                    onError: (error) =>
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to download document",
                      ),
                  })
                }
              >
                <IconDownload className="mr-2 h-4 w-4" />
                Download
              </Button>
              {latestFile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewerOpen(true)}
                >
                  <IconEye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              ) : null}
              {canTransition && nextStatus ? (
                <LoadingButton
                  type="button"
                  size="sm"
                  loading={setStatus.isPending}
                  onClick={transitionStatus}
                >
                  {formatStatus(nextStatus)}
                  <IconArrowRight className="ml-2 h-4 w-4" />
                </LoadingButton>
              ) : null}
              {canUploadRevision ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRevisionFiles([]);
                    setRevisionProgress(null);
                    setRevisionOpen(true);
                  }}
                >
                  <IconUpload className="mr-2 h-4 w-4" />
                  {review?.reviewState === "ChangesRequested"
                    ? "Upload & send revision"
                    : "Upload & send"}
                </Button>
              ) : null}
              {showSendRecovery ? (
                <LoadingButton
                  type="button"
                  size="sm"
                  loading={sendReport.isPending}
                  onClick={sendToClient}
                >
                  Send to client
                </LoadingButton>
              ) : null}
              {detail.category === "FinalReport" &&
              canManageReportReview &&
              review?.reviewState === "Locked" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOverrideOpen(true)}
                >
                  Override lock
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => setConfirmDelete(true)}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField
              label="Status"
              value={
                <StatusPill tone={resolveStatusTone(detail.status)}>
                  {formatStatusLabel(detail.status)}
                </StatusPill>
              }
            />
            <DetailField label="Phase" value={detail.phase || "—"} />
            <DetailField
              label="Updated"
              value={new Date(detail.updatedAt).toLocaleString()}
            />
            <DetailField
              label="Linked request"
              value={detail.requestId ? "Linked to request" : "Not linked"}
            />
          </div>
          {detail.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.description}
            </p>
          ) : null}

          {latestFile ? (
            <FileViewerDialog
              open={viewerOpen}
              onOpenChange={setViewerOpen}
              fileName={latestFile.fileName}
              mimeType={latestFile.mimeType}
              sizeBytes={latestFile.sizeBytes}
              getPreview={(opts) =>
                fetchDocumentFilePreview(detail.id, latestFile.id, opts)
              }
              getZipEntries={
                isZip
                  ? () => fetchDocumentZipEntries(detail.id, latestFile.id)
                  : undefined
              }
              getZipEntry={
                isZip
                  ? (entryPath) =>
                      fetchDocumentZipEntry(detail.id, latestFile.id, entryPath)
                  : undefined
              }
              onDownload={() =>
                openDocumentFileDownload(detail.id, latestFile.id)
              }
            />
          ) : null}

          {detail.category === "FinalReport" && canManageReportReview ? (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              {reportReview.isPending ? (
                <p className="text-sm text-muted-foreground">
                  Loading client review status…
                </p>
              ) : review ? (
                <>
                  <div
                    className={cn(
                      "rounded-lg border border-border px-4 py-3",
                      review.reviewState === "ChangesRequested" &&
                        "bg-amber-50 dark:bg-amber-950/30",
                      review.reviewState === "Locked" &&
                        "bg-destructive/5",
                      review.reviewState === "AwaitingClient" &&
                        "bg-sky-50 dark:bg-sky-950/30",
                      (review.reviewState === "Approved" ||
                        review.reviewState === "Overridden") &&
                        "bg-emerald-50 dark:bg-emerald-950/30",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Client review
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill tone={resolveStatusTone(review.reviewState)}>
                            {firmClientReviewLabel(review.reviewState)}
                          </StatusPill>
                          <span className="text-sm text-muted-foreground">
                            Round {review.reviewRound} of {review.maxRounds}
                            {" · "}v{detail.currentVersion}
                          </span>
                        </div>
                      </div>
                    </div>
                    {review.reviewState === "ChangesRequested" && latestFeedback ? (
                      <p className="mt-3 text-sm whitespace-pre-wrap">
                        <span className="font-medium">Client feedback: </span>
                        {latestFeedback}
                      </p>
                    ) : null}
                    {review.reviewState === "ChangesRequested" && needsNewerVersion ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Upload a revised file to send round{" "}
                        {(review.reviewRound ?? 0) + 1} to the client
                        automatically.
                      </p>
                    ) : null}
                    {review.reviewState === "Locked" ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Maximum review cycles used without approval. Override to
                        issue the report, or keep revising offline.
                      </p>
                    ) : null}
                    {review.reviewState === "Approved" ||
                    review.reviewState === "Overridden" ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        This report is finalised and issued to the client.
                      </p>
                    ) : null}
                  </div>

                  {review.cycles.length ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Review history</h3>
                      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                        {review.cycles.map((cycle) => (
                          <li key={cycle.id} className="space-y-1 p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">
                                Round {cycle.roundNo} · v{cycle.fileVersion}
                              </span>
                              <StatusPill tone={resolveStatusTone(cycle.decision)}>
                                {formatStatusLabel(cycle.decision)}
                              </StatusPill>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Sent {formatWhen(cycle.sentAt)}
                              {cycle.decidedAt
                                ? ` · Decided ${formatWhen(cycle.decidedAt)}`
                                : ""}
                            </p>
                            {cycle.feedback ? (
                              <p className="text-muted-foreground whitespace-pre-wrap">
                                {cycle.feedback}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-destructive">
                  Failed to load client review status
                </p>
              )}
            </div>
          ) : null}

          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Delete document?"
            description="This removes the document and all of its file versions. This action cannot be undone."
            confirmLabel="Delete"
            variant="destructive"
            confirming={remove.isPending}
            onConfirm={deleteDocument}
          />
          <FormDialog
            open={revisionOpen}
            onOpenChange={(open) => {
              setRevisionOpen(open);
              if (!open) {
                setRevisionFiles([]);
                setRevisionProgress(null);
                revisionSpeedRef.current = null;
              }
            }}
            title="Upload & send revised final report"
            description="Uploads a new file version and sends it to the client for the next review round automatically."
            maxWidthClass="sm:max-w-lg"
            footer={
              <LoadingButton
                type="button"
                loading={uploadRevision.isPending || sendReport.isPending}
                disabled={revisionFiles.length === 0}
                onClick={async () => {
                  const file = revisionFiles[0];
                  if (!file) return;
                  try {
                    revisionSpeedRef.current = null;
                    setRevisionProgress({
                      percent: 0,
                      bytesUploaded: 0,
                      bytesTotal: file.size,
                      speedBps: null,
                    });
                    await uploadRevision.mutateAsync({
                      documentId: detail.id,
                      file,
                      onBytesProgress: ({ percent, bytesUploaded, bytesTotal }) => {
                        const now = performance.now();
                        const prev = revisionSpeedRef.current;
                        let nextSpeed: number | null | undefined;
                        if (prev) {
                          const dt = (now - prev.t) / 1000;
                          if (dt >= 0.35) {
                            nextSpeed = Math.max(0, (bytesUploaded - prev.bytes) / dt);
                            revisionSpeedRef.current = { t: now, bytes: bytesUploaded };
                          }
                        } else {
                          revisionSpeedRef.current = { t: now, bytes: bytesUploaded };
                        }
                        setRevisionProgress((current) => ({
                          percent,
                          bytesUploaded,
                          bytesTotal,
                          speedBps:
                            nextSpeed !== undefined
                              ? nextSpeed
                              : (current?.speedBps ?? null),
                        }));
                      },
                    });
                    try {
                      await sendReport.mutateAsync();
                      toast.success("Revision uploaded and sent to the client");
                    } catch (sendError) {
                      toast.error(
                        sendError instanceof BffClientError
                          ? `Uploaded, but failed to send: ${sendError.message}`
                          : "Uploaded, but failed to send to the client",
                      );
                    }
                    setRevisionOpen(false);
                    setRevisionFiles([]);
                    setRevisionProgress(null);
                  } catch (error) {
                    toast.error(
                      error instanceof BffClientError
                        ? error.message
                        : "Failed to upload revision",
                    );
                  } finally {
                    revisionSpeedRef.current = null;
                  }
                }}
              >
                Upload & send
              </LoadingButton>
            }
          >
            <FormField label="File" required>
              <FileUpload
                files={revisionFiles}
                onChange={setRevisionFiles}
                accept={ATTACHMENT_ACCEPT}
                maxBytes={UPLOAD_MAX_BYTES}
                label="Choose revised document"
                description={`PDF, Office, images, video, zip, and more — up to ${formatMaxBytesLabel(UPLOAD_MAX_BYTES)}.`}
                disabled={uploadRevision.isPending}
              />
            </FormField>
            {revisionProgress != null && revisionFiles[0] ? (
              <div className="mt-3 space-y-1.5 rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium">
                    {revisionFiles[0].name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {revisionProgress.percent}%
                    {revisionProgress.bytesTotal > MULTIPART_THRESHOLD_BYTES
                      ? " · multipart"
                      : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-150"
                    style={{ width: `${revisionProgress.percent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </FormDialog>

          <FormDialog
            open={overrideOpen}
            onOpenChange={setOverrideOpen}
            title="Override locked final report"
            description="This finalises and issues the report without client approval."
            maxWidthClass="sm:max-w-lg"
            footer={
              <LoadingButton
                type="button"
                loading={overrideReport.isPending}
                onClick={overrideLockedReport}
              >
                Override and finalise
              </LoadingButton>
            }
          >
            <FormField label="Reason" required>
              <Textarea
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                rows={4}
              />
            </FormField>
          </FormDialog>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm">{value}</div>
    </div>
  );
}
