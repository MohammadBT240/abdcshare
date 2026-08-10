"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import {
  IconArrowRight,
  IconBuilding,
  IconCalendar,
  IconChevronDown,
  IconDownload,
  IconEye,
  IconLayersLinked,
  IconPencil,
  IconSend,
  IconTrash,
  IconUpload,
  IconUserPlus,
} from "@tabler/icons-react";
import {
  FormDialog,
  FormField,
  LoadingButton,
  AppSelect,
  MultiCombobox,
  DatePicker,
} from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/data/user-avatar";
import { StatusPill, resolveStatusTone } from "@/components/data";
import { FileTypeIcon } from "@/components/data/file-type-icon";
import { FileViewerDialog } from "@/components/files/file-viewer-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BffClientError } from "@/lib/bff/client";
import { cn } from "@/lib/utils";
import { useCatalogueList } from "@/features/catalogues/hooks/use-catalogue";
import { useDocumentsList } from "@/features/documents/hooks/use-documents";
import type { EngagementTeamMember } from "@/features/engagements/hooks/use-engagements";
import { STAGE_STYLES } from "@/features/engagements/lib/stage-styles";
import { ChangeRequestStatusDialog } from "@/features/requests/components/change-request-status-dialog";
import {
  fetchRequestBriefPreview,
  useAddRequestAssignee,
  useDownloadRequestBrief,
  useRemoveRequestAssignee,
  useRemoveRequestBrief,
  useUpdateRequest,
  useUploadRequestBrief,
  type RequestDetail,
} from "@/features/requests/hooks/use-requests";
import { useSubmitReview } from "@/features/reviews/hooks/use-reviews";
import { useSubmissions } from "@/features/submissions/hooks/use-submissions";
import {
  countsFromSubmissions,
  type SubmissionMetricCounts,
  SubmissionMetricCards,
} from "@/features/submissions/components/submission-metric-cards";
import { Progress } from "@/components/ui/progress";

interface RequestOverviewTabProps {
  request: RequestDetail;
  teamMembers: EngagementTeamMember[];
  /** Edit / stage / status — Super Admin (request:update + catalogue:view). */
  canManageRequest: boolean;
  /** Assignees — Super Admin (request:assign + catalogue:view). */
  canManageAssignees: boolean;
  canSubmitReview: boolean;
  canRespond: boolean;
  canReview: boolean;
  /** Opens the page-level Manage assignees dialog. */
  onManageAssignees?: () => void;
  /** Navigate to Submissions tab (primary workbench). */
  onGoToSubmissions?: () => void;
}

type NextStep = {
  title: string;
  description: string;
  ctaLabel: string;
  emphasis: "primary" | "amber" | "rose" | "muted";
};

function resolveNextStep(input: {
  canRespond: boolean;
  canReview: boolean;
  canSubmitReview: boolean;
  metrics: SubmissionMetricCounts;
  accepted: number;
  expected: number;
}): NextStep {
  const { canRespond, canReview, canSubmitReview, metrics, accepted, expected } =
    input;
  const reviewQueue = metrics.awaitingReview + metrics.underReview;

  if (canReview && reviewQueue > 0) {
    return {
      title:
        reviewQueue === 1
          ? "1 file needs your review"
          : `${reviewQueue} files need your review`,
      description:
        "Open Submissions to accept, return, or continue reviewing client files.",
      ctaLabel: "Review submissions",
      emphasis: "amber",
    };
  }

  if (canRespond && metrics.returned > 0) {
    return {
      title:
        metrics.returned === 1
          ? "1 file was returned"
          : `${metrics.returned} files were returned`,
      description:
        "Upload replacements or a new response from the Submissions tab.",
      ctaLabel: "Respond now",
      emphasis: "rose",
    };
  }

  if (canRespond && accepted < expected) {
    return {
      title: "Documents still needed",
      description: `Accepted ${accepted} of ${expected} expected. Continue from Submissions.`,
      ctaLabel: "Open submissions",
      emphasis: "primary",
    };
  }

  if (canSubmitReview) {
    return {
      title: "Ready for internal review?",
      description:
        "When work is ready, submit this request for a staff review cycle.",
      ctaLabel: "Submit for review",
      emphasis: "muted",
    };
  }

  return {
    title: "Request overview",
    description:
      "Use Submissions for client files and responses. Details and brief are below.",
    ctaLabel: "Open submissions",
    emphasis: "muted",
  };
}

const nextStepTone: Record<NextStep["emphasis"], string> = {
  primary: "border-primary/25 bg-primary/5",
  amber: "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30",
  rose: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
  muted: "border-border bg-muted/30",
};

export function RequestOverviewTab({
  request,
  teamMembers,
  canManageRequest,
  canManageAssignees,
  canSubmitReview,
  canRespond,
  canReview,
  onManageAssignees,
  onGoToSubmissions,
}: RequestOverviewTabProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);

  const submissions = useSubmissions(request.id, true, { page: 1, pageSize: 100 });
  const submissionMetrics = useMemo(
    () => countsFromSubmissions(submissions.data?.data ?? []),
    [submissions.data?.data],
  );

  const phaseStyle = STAGE_STYLES[request.phase] ?? STAGE_STYLES.Planning;
  const nextStep = resolveNextStep({
    canRespond,
    canReview,
    canSubmitReview,
    metrics: submissionMetrics,
    accepted: request.acceptedFileCount,
    expected: request.expectedDocumentCount,
  });

  const attentionBits = [
    submissionMetrics.awaitingReview > 0
      ? `${submissionMetrics.awaitingReview} awaiting review`
      : null,
    submissionMetrics.underReview > 0
      ? `${submissionMetrics.underReview} under review`
      : null,
    submissionMetrics.returned > 0
      ? `${submissionMetrics.returned} returned`
      : null,
  ].filter(Boolean);

  function handlePrimaryCta() {
    if (nextStep.ctaLabel === "Submit for review") {
      setReviewOpen(true);
      return;
    }
    onGoToSubmissions?.();
  }

  return (
    <div className="space-y-4">
      <section
        className={cn(
          "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
          nextStepTone[nextStep.emphasis],
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next step
          </p>
          <h2 className="text-base font-semibold tracking-tight">
            {nextStep.title}
          </h2>
          <p className="text-sm text-muted-foreground">{nextStep.description}</p>
          {attentionBits.length > 0 ? (
            <p className="text-xs font-medium text-foreground/80">
              Needs attention: {attentionBits.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" onClick={handlePrimaryCta}>
            {nextStep.ctaLabel === "Review submissions" ||
            nextStep.ctaLabel === "Respond now" ||
            nextStep.ctaLabel === "Open submissions" ? (
              <IconArrowRight className="mr-1.5 h-4 w-4" />
            ) : (
              <IconSend className="mr-1.5 h-4 w-4" />
            )}
            {nextStep.ctaLabel}
          </Button>
          {nextStep.ctaLabel !== "Open submissions" &&
          nextStep.ctaLabel !== "Review submissions" &&
          nextStep.ctaLabel !== "Respond now" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onGoToSubmissions?.()}
            >
              Open submissions
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Document delivery</h2>
            <p className="text-xs text-muted-foreground">
              Accepted {request.acceptedFileCount} of{" "}
              {request.expectedDocumentCount} expected (
              {request.progressPercent}%)
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onGoToSubmissions?.()}
          >
            Manage files
            <IconArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
        <Progress value={request.progressPercent} className="h-2" />
        <SubmissionMetricCards counts={submissionMetrics} />
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Request details</h2>
            <p className="text-xs text-muted-foreground">
              Lifecycle, scope, and timing
            </p>
          </div>
          <IconChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              detailsOpen && "rotate-180",
            )}
          />
        </button>

        {detailsOpen ? (
          <div>
            {(canManageRequest || canManageAssignees || canSubmitReview) && (
              <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
                {canManageRequest ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditOpen(true)}
                    >
                      <IconPencil className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setStatusOpen(true)}
                    >
                      Change status
                    </Button>
                  </>
                ) : null}
                {canManageAssignees ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onManageAssignees?.()}
                  >
                    <IconUserPlus className="mr-1.5 h-4 w-4" />
                    Assignees
                  </Button>
                ) : null}
                {canSubmitReview ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setReviewOpen(true)}
                  >
                    <IconSend className="mr-1.5 h-4 w-4" />
                    Submit for review
                  </Button>
                ) : null}
              </div>
            )}

            <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              <DetailCell
                icon={<IconLayersLinked className="h-3.5 w-3.5" />}
                label="Type"
                value={request.requestTypeName}
              />
              <DetailCell
                icon={<FileTypeIcon kind="folder" size={14} />}
                label="Class"
                value={request.requestClassName}
              />
              <DetailCell
                label="Phase"
                value={
                  <Badge
                    variant="secondary"
                    className={cn("border-transparent", phaseStyle.className)}
                  >
                    {request.phase}
                  </Badge>
                }
              />
              <DetailCell
                label="Stage"
                value={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{request.stage || "—"}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      (auto)
                    </span>
                  </span>
                }
              />
              <DetailCell
                label="Status"
                value={
                  request.status ? (
                    <StatusPill tone={resolveStatusTone(request.status)}>
                      {request.status}
                    </StatusPill>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailCell
                label="Expected docs"
                value={`${request.acceptedFileCount} / ${request.expectedDocumentCount} (${request.progressPercent}%)`}
              />
              <DetailCell
                icon={<IconCalendar className="h-3.5 w-3.5" />}
                label="Due date"
                value={
                  request.dueDate ? (
                    <span
                      className={
                        request.isOverdue
                          ? "font-medium text-destructive"
                          : undefined
                      }
                    >
                      {new Date(request.dueDate).toLocaleDateString()}
                      {request.isOverdue ? " · Overdue" : ""}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailCell
                icon={<IconBuilding className="h-3.5 w-3.5" />}
                label="Department"
                value={request.departmentName || "—"}
              />
              <DetailCell
                label="Created"
                value={new Date(request.createdAt).toLocaleString()}
              />
            </dl>
          </div>
        ) : null}
      </section>

      {editOpen ? (
        <EditRequestDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          request={request}
        />
      ) : null}
      {statusOpen ? (
        <ChangeRequestStatusDialog
          open={statusOpen}
          onOpenChange={setStatusOpen}
          request={request}
        />
      ) : null}
      {reviewOpen ? (
        <SubmitReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          request={request}
          teamMembers={teamMembers}
        />
      ) : null}
    </div>
  );
}

function SubmitReviewDialog({
  open,
  onOpenChange,
  request,
  teamMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDetail;
  teamMembers: EngagementTeamMember[];
}) {
  const submitReview = useSubmitReview();
  const [reviewerId, setReviewerId] = useState("");
  const [notes, setNotes] = useState("");

  const reviewerOptions = teamMembers.map((member) => ({
    value: member.userId,
    label: `${member.fullName} · ${member.memberRole}`,
  }));

  async function submit() {
    if (!reviewerId) {
      toast.error("Select a reviewer");
      return;
    }
    try {
      await submitReview.mutateAsync({
        requestId: request.id,
        reviewerId,
        notes: notes.trim() || undefined,
      });
      toast.success("Request submitted for review");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to submit review",
      );
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Submit request for review"
      description="Assign this request to a reviewer from the engagement team."
      maxWidthClass="sm:max-w-lg"
      footer={
        <LoadingButton
          type="button"
          loading={submitReview.isPending}
          onClick={submit}
        >
          Submit for review
        </LoadingButton>
      }
    >
      <div className="space-y-4">
        <FormField label="Reviewer" required>
          <AppSelect
            value={reviewerId}
            onValueChange={setReviewerId}
            options={reviewerOptions}
            placeholder="Search and select reviewer…"
            searchPlaceholder="Search team…"
          />
        </FormField>
        <FormField label="Notes">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
          />
        </FormField>
      </div>
    </FormDialog>
  );
}

/** Linked working papers tab — staff/SA only (not shown to clients). */
export function RequestLinkedWorkingPapersTab({
  request,
  enabled = true,
}: {
  request: RequestDetail;
  enabled?: boolean;
}) {
  const query = new URLSearchParams({
    engagementId: request.engagementId,
    requestId: request.id,
    category: "WorkingPaper",
    pageSize: "50",
  }).toString();
  const documents = useDocumentsList(query, enabled);
  const documentsHref =
    `/engagements/${request.engagementId}?tab=documents&category=WorkingPaper` +
    `&classId=${request.requestClassId}&requestId=${request.id}`;

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Linked working papers</h2>
          <p className="text-xs text-muted-foreground">
            Documents linked directly to this request
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={documentsHref}>
            View all
            <IconArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="p-3">
        {documents.isPending ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            Loading working papers…
          </p>
        ) : documents.isError ? (
          <p className="px-1 py-4 text-sm text-destructive">
            Failed to load working papers
          </p>
        ) : documents.data?.data.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {documents.data.data.map((document) => (
              <li key={document.id}>
                <Link
                  href={documentsHref}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileTypeIcon kind="folder" size={18} />
                    <span className="truncate font-medium">{document.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    v{document.currentVersion} ·{" "}
                    {document.status.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="relative overflow-hidden rounded-md border border-border bg-muted/20 px-4 py-8 text-center">
            <Image
              src="/illustrations/working.svg"
              alt=""
              width={120}
              height={120}
              unoptimized
              aria-hidden
              className="mx-auto mb-3 h-20 w-20 object-contain opacity-70 dark:opacity-50"
            />
            <p className="text-sm font-medium">No working papers yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Link or upload papers from the engagement Documents page.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-3" asChild>
              <Link href={documentsHref}>Open documents</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function DetailCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon ? <span className="text-muted-foreground/80">{icon}</span> : null}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function BriefIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Compact expectation-brief row for the request header. */
export function RequestExpectationBriefStrip({
  request,
  canManageBrief,
  className,
}: {
  request: RequestDetail;
  canManageBrief: boolean;
  className?: string;
}) {
  const download = useDownloadRequestBrief(request.id);
  const remove = useRemoveRequestBrief(request.id);
  const upload = useUploadRequestBrief(request.id);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  async function onDownload() {
    try {
      const res = await download.mutateAsync();
      window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof BffClientError
          ? err.message
          : "Failed to download brief",
      );
    }
  }

  async function onRemove() {
    try {
      await remove.mutateAsync();
      toast.success("Expectation brief removed");
    } catch (err) {
      toast.error(
        err instanceof BffClientError ? err.message : "Failed to remove brief",
      );
    }
  }

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.success(
        request.brief ? "Expectation brief replaced" : "Expectation brief uploaded",
      );
    } catch (err) {
      toast.error(
        err instanceof BffClientError ? err.message : "Failed to upload brief",
      );
    } finally {
      if (fileInput) fileInput.value = "";
    }
  }

  const busy = download.isPending || remove.isPending || upload.isPending;
  const brief = request.brief;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-t border-border/60 pt-3",
          className,
        )}
      >
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Brief
        </span>

        {brief ? (
          <>
            <FileTypeIcon
              fileName={brief.fileName}
              mimeType={brief.contentType ?? undefined}
              size={22}
              className="shrink-0"
            />
            <button
              type="button"
              className="min-w-0 max-w-[14rem] truncate text-left text-sm font-medium text-primary hover:underline sm:max-w-xs"
              onClick={() => setViewerOpen(true)}
              title={brief.fileName}
            >
              {brief.fileName}
            </button>
            {brief.uploadedAt ? (
              <span
                className="hidden text-xs text-muted-foreground sm:inline"
                title={new Date(brief.uploadedAt).toLocaleString()}
              >
                {new Date(brief.uploadedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-0.5">
              <BriefIconButton
                label="View brief"
                disabled={busy}
                onClick={() => setViewerOpen(true)}
              >
                <IconEye className="h-4 w-4" />
              </BriefIconButton>
              <BriefIconButton
                label="Download brief"
                disabled={busy}
                onClick={() => void onDownload()}
              >
                <IconDownload className="h-4 w-4" />
              </BriefIconButton>
              {canManageBrief ? (
                <>
                  <input
                    ref={setFileInput}
                    type="file"
                    className="hidden"
                    onChange={(e) => onFileSelected(e.target.files?.[0])}
                  />
                  <BriefIconButton
                    label="Replace brief"
                    disabled={busy}
                    onClick={() => fileInput?.click()}
                  >
                    <IconUpload className="h-4 w-4" />
                  </BriefIconButton>
                  <BriefIconButton
                    label="Remove brief"
                    disabled={busy}
                    onClick={() => void onRemove()}
                  >
                    <IconTrash className="h-4 w-4" />
                  </BriefIconButton>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">No brief attached</span>
            {canManageBrief ? (
              <div className="ml-auto flex items-center gap-0.5">
                <input
                  ref={setFileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => onFileSelected(e.target.files?.[0])}
                />
                <BriefIconButton
                  label="Upload brief"
                  disabled={busy}
                  onClick={() => fileInput?.click()}
                >
                  <IconUpload className="h-4 w-4" />
                </BriefIconButton>
              </div>
            ) : null}
          </>
        )}

        {brief ? (
          <FileViewerDialog
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            fileName={brief.fileName}
            mimeType={brief.contentType}
            sizeBytes={brief.sizeBytes}
            getPreview={(opts) => fetchRequestBriefPreview(request.id, opts)}
            onDownload={onDownload}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function EditRequestDialog({
  open,
  onOpenChange,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDetail;
}) {
  const update = useUpdateRequest(request.id);
  const [description, setDescription] = useState(request.description ?? "");
  const [dueDate, setDueDate] = useState<Date | undefined>(() =>
    request.dueDate ? new Date(request.dueDate) : undefined,
  );
  const [expectedDocumentCount, setExpectedDocumentCount] = useState(
    request.expectedDocumentCount ?? 1,
  );

  useEffect(() => {
    if (!open) return;
    setDescription(request.description ?? "");
    setDueDate(request.dueDate ? new Date(request.dueDate) : undefined);
    setExpectedDocumentCount(request.expectedDocumentCount ?? 1);
  }, [open, request.description, request.dueDate, request.expectedDocumentCount]);

  async function onSubmit() {
    try {
      await update.mutateAsync({
        description: description.trim() || undefined,
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined,
        expectedDocumentCount,
      });
      toast.success("Request updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof BffClientError
          ? err.message
          : "Failed to update request",
      );
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit request"
      maxWidthClass="sm:max-w-lg"
      footer={
        <LoadingButton
          type="button"
          loading={update.isPending}
          onClick={onSubmit}
        >
          Save
        </LoadingButton>
      }
    >
      <div className="space-y-4">
        <FormField label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </FormField>
        <FormField
          label="Expected documents"
          description="Accepted client files ÷ this number drives progress."
        >
          <Input
            type="number"
            min={1}
            max={500}
            value={expectedDocumentCount}
            onChange={(e) =>
              setExpectedDocumentCount(
                Math.min(500, Math.max(1, Number(e.target.value) || 1)),
              )
            }
          />
        </FormField>
        <FormField label="Due date">
          <DatePicker value={dueDate} onChange={setDueDate} />
        </FormField>
      </div>
    </FormDialog>
  );
}

export function ManageAssigneesDialog({
  open,
  onOpenChange,
  request,
  teamMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDetail;
  teamMembers: EngagementTeamMember[];
}) {
  const add = useAddRequestAssignee(request.id);
  const remove = useRemoveRequestAssignee(request.id);
  const [selected, setSelected] = useState<string[]>(() =>
    request.assignees.map((a) => a.userId),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(request.assignees.map((a) => a.userId));
  }, [open, request.assignees]);

  async function onSubmit() {
    const current = new Set(request.assignees.map((a) => a.userId));
    const next = new Set(selected);
    const toAdd = selected.filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !next.has(id));
    setSaving(true);
    try {
      for (const userId of toAdd) {
        await add.mutateAsync({ userId });
      }
      for (const userId of toRemove) {
        await remove.mutateAsync(userId);
      }
      toast.success("Assignees updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof BffClientError
          ? err.message
          : "Failed to update assignees",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manage assignees"
      description="Only engagement team members can be assigned. Search and select one or more."
      maxWidthClass="sm:max-w-lg"
      footer={
        <LoadingButton type="button" loading={saving} onClick={onSubmit}>
          Save
        </LoadingButton>
      }
    >
      {teamMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No team members on this engagement.
        </p>
      ) : (
        <MultiCombobox
          values={selected}
          onValuesChange={setSelected}
          options={teamMembers.map((m) => ({
            value: m.userId,
            label: m.fullName,
            description: m.memberRole,
            avatarUrl: m.avatarUrl,
          }))}
          placeholder="Search and select assignees…"
          searchPlaceholder="Search team…"
          emptyMessage="No matching team members"
        />
      )}
    </FormDialog>
  );
}
