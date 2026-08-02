"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  IconArrowRight,
  IconDownload,
  IconEye,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data/data-table";
import { FileTypeIcon } from "@/components/data/file-type-icon";
import {
  AppSelect,
  ConfirmDialog,
  FileUpload,
  FormDialog,
  FormField,
  LoadingButton,
} from "@/components/forms";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useAuthContext } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type DocumentCategory,
  type DocumentDetail,
  type DocumentListItem,
  type DocumentStatus,
  useCreateDocument,
  useDeleteDocument,
  useDocument,
  useDocumentsList,
  useDownloadDocument,
  useExportDocuments,
  useDocumentPreview,
  useSetDocumentStatus,
  useUploadDocumentFile,
} from "@/features/documents/hooks/use-documents";
import { useEngagementWorkspace } from "@/features/engagements/hooks/use-engagements";
import {
  useFirmReportReview,
  useOverrideFinalReport,
  useSendFinalReport,
} from "@/features/report-reviews/hooks/use-report-reviews";
import { useRequestsList } from "@/features/requests/hooks/use-requests";
import { BffClientError } from "@/lib/bff/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface EngagementDocumentsPageProps {
  params: Promise<{ id: string }>;
}

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

function DocumentsPageInner({ engagementId }: { engagementId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useAuthContext();
  const workspace = useEngagementWorkspace(engagementId);
  const category = parseCategory(searchParams.get("category"));
  const classId = searchParams.get("classId") ?? "";
  const requestId = searchParams.get("requestId") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const exportDocuments = useExportDocuments();

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
      toast.error(error instanceof BffClientError ? error.message : "Failed to queue export");
    }
  }

  function setQuery(patch: {
    category?: Extract<DocumentCategory, "WorkingPaper" | "FinalReport">;
    classId?: string;
    page?: number;
  }) {
    const next = new URLSearchParams(searchParams.toString());
    if (patch.category) next.set("category", patch.category);
    if (patch.classId !== undefined) {
      if (patch.classId) next.set("classId", patch.classId);
      else next.delete("classId");
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
          <Badge variant="outline">{formatStatus(row.original.status)}</Badge>
        ),
      },
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

  if (workspace.isPending) {
    return (
      <div className="space-y-5">
        <PageToolbar
          title="Documents"
          breadcrumbs={[
            { label: "Home", href: "/dashboard" },
            { label: "Engagements", href: "/engagements" },
          ]}
        />
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      </div>
    );
  }

  if (workspace.isError || !workspace.data) {
    return (
      <div className="space-y-5">
        <PageToolbar
          title="Documents"
          breadcrumbs={[
            { label: "Home", href: "/dashboard" },
            { label: "Engagements", href: "/engagements" },
          ]}
        />
        <p className="text-sm text-destructive">Failed to load engagement</p>
      </div>
    );
  }

  const ws = workspace.data;
  const classOptions = ws.classRollups.map((item) => ({
    value: String(item.requestClassId),
    label: item.name,
  }));
  return (
    <div className="space-y-3">
      <PageToolbar
        title="Documents"
        className="mb-2 sm:mb-3"
        description={`${ws.referenceCode} · ${ws.title}`}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Engagements", href: "/engagements" },
          { label: ws.referenceCode, href: `/engagements/${engagementId}` },
          { label: "Documents" },
        ]}
        actions={
          <div className="flex items-center gap-2">
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
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/engagements/${engagementId}`}>Workspace</Link>
            </Button>
            {canUpload ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setUploadOpen(true)}
              >
                <FileTypeIcon kind="upload" size={16} className="mr-1.5" />
                Upload
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          value={category}
          onValueChange={(value) => {
            const next = parseCategory(value);
            setQuery({
              category: next,
              // Final reports are engagement-scoped — clear class filter.
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
        {category === "WorkingPaper" ? (
          <div className="w-full lg:w-72">
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
      </div>

      {requestId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Filtered to documents linked to one request.
          </p>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link
              href={`/engagements/${engagementId}/documents?category=${category}${classId ? `&classId=${classId}` : ""}`}
            >
              Clear request filter
            </Link>
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
  const requests = useRequestsList(`engagementId=${engagementId}&pageSize=100`);
  const isWorkingPaper = category === "WorkingPaper";
  const [selectedClassId, setSelectedClassId] = useState(
    isWorkingPaper ? classId : "",
  );
  const [requestId, setRequestId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

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
  const saving = createDocument.isPending || uploadFile.isPending;

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
      await uploadFile.mutateAsync({ documentId: created.id, file });
      toast.success(
        isWorkingPaper ? "Working paper uploaded" : "Final report uploaded",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to upload document",
      );
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
          : "Engagement deliverable for client review cycles. Super Admin only."
      }
      maxWidthClass="sm:max-w-2xl"
      footer={
        <LoadingButton type="button" loading={saving} onClick={submit}>
          Upload
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
            label="Choose document"
            description="Upload one file, up to 100 MB."
            disabled={saving}
          />
        </FormField>
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
  const preview = useDocumentPreview();
  const setStatus = useSetDocumentStatus(id);
  const remove = useDeleteDocument();
  const reportReview = useFirmReportReview(
    id,
    canManageReportReview && document.data?.category === "FinalReport",
  );
  const sendReport = useSendFinalReport(id);
  const overrideReport = useOverrideFinalReport(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

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
  const canPreview = Boolean(
    latestFile &&
    (latestFile.mimeType?.startsWith("image/") ||
      latestFile.mimeType?.startsWith("text/") ||
      latestFile.mimeType === "application/pdf" ||
      latestFile.mimeType === "application/json"),
  );

  async function previewDocument() {
    if (!latestFile) return;
    try {
      const result = await preview.mutateAsync({
        documentId: detail.id,
        fileId: latestFile.id,
      });
      setPreviewUrl(result.url);
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to preview document",
      );
    }
  }

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
              {canPreview ? (
                <LoadingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={preview.isPending}
                  onClick={previewDocument}
                >
                  <IconEye className="mr-2 h-4 w-4" />
                  Preview
                </LoadingButton>
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
              {detail.category === "FinalReport" &&
              canManageReportReview &&
              reportReview.data &&
              ["NotSent", "ChangesRequested"].includes(
                reportReview.data.reviewState,
              ) ? (
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
              reportReview.data?.reviewState === "Locked" ? (
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
            <DetailField label="Status" value={formatStatus(detail.status)} />
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

          {previewUrl ? (
            <div className="mt-5 overflow-hidden rounded-md border border-border bg-muted/20">
              <iframe
                src={previewUrl}
                title={`Preview ${latestFile?.fileName ?? detail.title}`}
                className="h-[65vh] w-full bg-white"
              />
            </div>
          ) : latestFile && !canPreview ? (
            <p className="mt-5 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Preview is unavailable for{" "}
              {latestFile.mimeType || "this file type"}. Download the file to
              view it.
            </p>
          ) : null}

          {detail.category === "FinalReport" && canManageReportReview ? (
            <div className="mt-4 border-t border-border pt-4">
              {reportReview.isPending ? (
                <p className="text-sm text-muted-foreground">
                  Loading client review status…
                </p>
              ) : reportReview.data ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField
                    label="Client review"
                    value={reportReview.data.reviewState.replace(
                      /([a-z])([A-Z])/g,
                      "$1 $2",
                    )}
                  />
                  <DetailField
                    label="Review cycle"
                    value={`${reportReview.data.reviewRound} of ${reportReview.data.maxRounds}`}
                  />
                </div>
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default function EngagementDocumentsPage({
  params,
}: EngagementDocumentsPageProps) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      }
    >
      <DocumentsPageInner engagementId={id} />
    </Suspense>
  );
}
