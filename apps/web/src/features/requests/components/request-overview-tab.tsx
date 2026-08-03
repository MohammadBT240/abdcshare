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
  IconLayersLinked,
  IconPencil,
  IconSend,
  IconUserPlus,
} from "@tabler/icons-react";
import {
  FormDialog,
  FormField,
  LoadingButton,
  AppSelect,
  DatePicker,
} from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/data/user-avatar";
import { FileTypeIcon } from "@/components/data/file-type-icon";
import { BffClientError } from "@/lib/bff/client";
import { cn } from "@/lib/utils";
import { useCatalogueList } from "@/features/catalogues/hooks/use-catalogue";
import { useDocumentsList } from "@/features/documents/hooks/use-documents";
import type { EngagementTeamMember } from "@/features/engagements/hooks/use-engagements";
import { STAGE_STYLES } from "@/features/engagements/lib/stage-styles";
import {
  useAddRequestAssignee,
  useRemoveRequestAssignee,
  useTransitionRequestStage,
  useUpdateRequest,
  useUpdateRequestStatus,
  type RequestDetail,
} from "@/features/requests/hooks/use-requests";
import { useSubmitReview, useReviewsList } from "@/features/reviews/hooks/use-reviews";
import { useSubmissions } from "@/features/submissions/hooks/use-submissions";
import {
  countsFromSubmissions,
  SubmissionMetricCards,
} from "@/features/submissions/components/submission-metric-cards";
import { RequestSubmissionsPanel } from "@/features/submissions/components/request-submissions-tab";

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
}

export function RequestOverviewTab({
  request,
  teamMembers,
  canManageRequest,
  canManageAssignees,
  canSubmitReview,
  canRespond,
  canReview,
  onManageAssignees,
}: RequestOverviewTabProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);

  const submissions = useSubmissions(request.id, true, { page: 1, pageSize: 100 });
  const openReviews = useReviewsList(
    `requestId=${request.id}&status=ForReview&pageSize=1`,
  );
  const submissionMetrics = useMemo(
    () =>
      countsFromSubmissions(
        submissions.data?.data ?? [],
        openReviews.data?.meta.total ?? 0,
      ),
    [submissions.data?.data, openReviews.data?.meta.total],
  );

  const phaseStyle = STAGE_STYLES[request.phase] ?? STAGE_STYLES.Planning;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold">Client documents</h2>
          <p className="text-xs text-muted-foreground">
            Files and review status for this request
          </p>
        </div>
        <SubmissionMetricCards counts={submissionMetrics} />
      </section>

      <div className="relative flex flex-col gap-3 lg:block">
        <section className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:w-[calc((100%-0.75rem)/3)]">
          <button
            type="button"
            className="flex w-full shrink-0 items-start justify-between gap-2 px-4 py-3 text-left"
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
                        onClick={() => setStageOpen(true)}
                      >
                        Change stage
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
                      onClick={() => setReviewOpen(true)}
                    >
                      <IconSend className="mr-1.5 h-4 w-4" />
                      Submit for review
                    </Button>
                  ) : null}
                </div>
              )}

              <dl className="grid gap-px border-t border-border bg-border">
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
                <DetailCell label="Stage" value={request.stage || "—"} />
                <DetailCell label="Status" value={request.status || "—"} />
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

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:absolute lg:inset-y-0 lg:right-0 lg:left-[calc((100%-0.75rem)/3+0.75rem)]">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <RequestSubmissionsPanel
              requestId={request.id}
              canRespond={canRespond}
              canReview={canReview}
              enabled
              hideMetrics
            />
          </div>
        </section>
      </div>

      {editOpen ? (
        <EditRequestDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          request={request}
        />
      ) : null}
      {stageOpen ? (
        <ChangeStageDialog
          open={stageOpen}
          onOpenChange={setStageOpen}
          request={request}
        />
      ) : null}
      {statusOpen ? (
        <ChangeStatusDialog
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
            placeholder="Select reviewer"
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

  useEffect(() => {
    if (!open) return;
    setDescription(request.description ?? "");
    setDueDate(request.dueDate ? new Date(request.dueDate) : undefined);
  }, [open, request.description, request.dueDate]);

  async function onSubmit() {
    try {
      await update.mutateAsync({
        description: description.trim() || undefined,
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined,
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
        <FormField label="Due date">
          <DatePicker value={dueDate} onChange={setDueDate} />
        </FormField>
      </div>
    </FormDialog>
  );
}

function ChangeStageDialog({
  open,
  onOpenChange,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDetail;
}) {
  const transition = useTransitionRequestStage(request.id);
  const stages = useCatalogueList(
    "request-stages",
    "pageSize=100&isActive=true",
  );
  const [stageId, setStageId] = useState(
    request.stageId ? String(request.stageId) : "",
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setStageId(request.stageId ? String(request.stageId) : "");
    setNote("");
  }, [open, request.stageId]);

  const options = useMemo(
    () =>
      (stages.data?.data ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    [stages.data],
  );

  async function onSubmit() {
    if (!stageId) {
      toast.error("Select a stage");
      return;
    }
    try {
      await transition.mutateAsync({
        stageId: Number(stageId),
        note: note.trim() || undefined,
      });
      toast.success("Stage updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof BffClientError ? err.message : "Failed to change stage",
      );
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change stage"
      maxWidthClass="sm:max-w-lg"
      footer={
        <LoadingButton
          type="button"
          loading={transition.isPending}
          onClick={onSubmit}
        >
          Save
        </LoadingButton>
      }
    >
      <div className="space-y-4">
        <FormField label="Stage" required>
          <AppSelect
            value={stageId}
            onValueChange={setStageId}
            options={options}
            placeholder="Select stage"
          />
        </FormField>
        <FormField label="Note">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </FormField>
      </div>
    </FormDialog>
  );
}

function ChangeStatusDialog({
  open,
  onOpenChange,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDetail;
}) {
  const updateStatus = useUpdateRequestStatus(request.id);
  const statuses = useCatalogueList(
    "request-statuses",
    "pageSize=100&isActive=true",
  );
  const [statusId, setStatusId] = useState(
    request.statusId ? String(request.statusId) : "",
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatusId(request.statusId ? String(request.statusId) : "");
    setNote("");
  }, [open, request.statusId]);

  const options = useMemo(
    () =>
      (statuses.data?.data ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    [statuses.data],
  );

  async function onSubmit() {
    if (!statusId) {
      toast.error("Select a status");
      return;
    }
    try {
      await updateStatus.mutateAsync({
        statusId: Number(statusId),
        note: note.trim() || undefined,
      });
      toast.success("Status updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof BffClientError ? err.message : "Failed to change status",
      );
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change status"
      maxWidthClass="sm:max-w-lg"
      footer={
        <LoadingButton
          type="button"
          loading={updateStatus.isPending}
          onClick={onSubmit}
        >
          Save
        </LoadingButton>
      }
    >
      <div className="space-y-4">
        <FormField label="Status" required>
          <AppSelect
            value={statusId}
            onValueChange={setStatusId}
            options={options}
            placeholder="Select status"
          />
        </FormField>
        <FormField label="Note">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
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
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(request.assignees.map((a) => a.userId)),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(request.assignees.map((a) => a.userId)));
  }, [open, request.assignees]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function onSubmit() {
    const current = new Set(request.assignees.map((a) => a.userId));
    const toAdd = [...selected].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !selected.has(id));
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
      description="Only engagement team members can be assigned."
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
        <ul className="space-y-2">
          {teamMembers.map((m) => (
            <li
              key={m.userId}
              className="flex items-center gap-3 rounded-md border border-border p-2"
            >
              <Checkbox
                checked={selected.has(m.userId)}
                onCheckedChange={() => toggle(m.userId)}
                id={`assignee-${m.userId}`}
              />
              <label
                htmlFor={`assignee-${m.userId}`}
                className="flex flex-1 cursor-pointer items-center gap-2 text-sm"
              >
                <UserAvatar
                  src={m.avatarUrl}
                  initials={m.fullName.slice(0, 2)}
                  size="sm"
                />
                <span>
                  {m.fullName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {m.memberRole}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </FormDialog>
  );
}
