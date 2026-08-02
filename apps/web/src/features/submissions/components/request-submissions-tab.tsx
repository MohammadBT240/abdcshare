'use client';

import { useState } from 'react';
import {
  IconCheck,
  IconClock,
  IconMessageReply,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { SubmissionStatus } from '@abdcshare/shared';
import { toast } from 'sonner';
import { FileUpload, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import {
  type Submission,
  useCreateSubmission,
  useReviewSubmission,
  useSubmissions,
} from '@/features/submissions/hooks/use-submissions';
import { useReviewsList } from '@/features/reviews/hooks/use-reviews';
import {
  countsFromSubmissions,
  SubmissionMetricCards,
} from '@/features/submissions/components/submission-metric-cards';
import { FileTypeIcon } from '@/components/data/file-type-icon';

interface RequestSubmissionsTabProps {
  requestId: string;
  canRespond: boolean;
  canReview: boolean;
  enabled?: boolean;
}

function statusVariant(status: SubmissionStatus): BadgeProps['variant'] {
  if (status === SubmissionStatus.Accepted) return 'success';
  if (status === SubmissionStatus.Returned) return 'destructive';
  return 'secondary';
}

function formatBytes(bytes?: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof BffClientError ? error.message : fallback;
}

function RespondDialog({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateSubmission(requestId);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  function reset() {
    setMessage('');
    setFiles([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    try {
      await create.mutateAsync({ message: trimmedMessage, files });
      toast.success('Response sent for review');
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to send response'));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !create.isPending) reset();
        onOpenChange(next);
      }}
      title="Respond to request"
      description="Send your response and any supporting files to the engagement team."
      maxWidthClass="sm:max-w-xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="request-response-form"
            loading={create.isPending}
            disabled={!message.trim()}
          >
            Send response
          </LoadingButton>
        </>
      }
    >
      <form id="request-response-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Message" htmlFor="submission-message" required>
          <Textarea
            id="submission-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe your response and any context the review team needs…"
            rows={6}
            disabled={create.isPending}
          />
        </FormField>
        <FormField label="Supporting files (optional)">
          <FileUpload
            files={files}
            onChange={setFiles}
            multiple
            disabled={create.isPending}
            label="Attach supporting files"
            description="Add one or more files that support this response."
          />
        </FormField>
      </form>
    </FormDialog>
  );
}

function ReviewDialog({
  requestId,
  submission,
  onOpenChange,
}: {
  requestId: string;
  submission: Submission | null;
  onOpenChange: (open: boolean) => void;
}) {
  const review = useReviewSubmission(requestId);
  const [decision, setDecision] = useState<
    SubmissionStatus.Accepted | SubmissionStatus.Returned
  >(SubmissionStatus.Accepted);
  const [reason, setReason] = useState('');

  function close() {
    if (review.isPending) return;
    setDecision(SubmissionStatus.Accepted);
    setReason('');
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!submission || (decision === SubmissionStatus.Returned && !reason.trim())) return;

    try {
      await review.mutateAsync({
        submissionId: submission.id,
        decision,
        reason: reason.trim() || undefined,
      });
      toast.success(
        decision === SubmissionStatus.Accepted ? 'Response accepted' : 'Response returned',
      );
      close();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to review response'));
    }
  }

  return (
    <FormDialog
      open={Boolean(submission)}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title="Review response"
      description={
        submission
          ? `Submitted by ${submission.submittedByName || 'Client'} on ${new Date(
              submission.createdAt,
            ).toLocaleString()}`
          : undefined
      }
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={review.isPending}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="review-submission-form"
            loading={review.isPending}
            disabled={decision === SubmissionStatus.Returned && !reason.trim()}
          >
            {decision === SubmissionStatus.Accepted ? 'Accept response' : 'Return response'}
          </LoadingButton>
        </>
      }
    >
      <form id="review-submission-form" className="space-y-4" onSubmit={handleSubmit}>
        {submission ? (
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm">{submission.message}</p>
          </div>
        ) : null}
        <FormField label="Decision" required>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={decision === SubmissionStatus.Accepted ? 'default' : 'outline'}
              onClick={() => setDecision(SubmissionStatus.Accepted)}
              disabled={review.isPending}
              aria-pressed={decision === SubmissionStatus.Accepted}
            >
              <IconCheck className="mr-2 h-4 w-4" />
              Accept
            </Button>
            <Button
              type="button"
              variant={decision === SubmissionStatus.Returned ? 'default' : 'outline'}
              className={
                decision === SubmissionStatus.Returned
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => setDecision(SubmissionStatus.Returned)}
              disabled={review.isPending}
              aria-pressed={decision === SubmissionStatus.Returned}
            >
              <IconRotateClockwise className="mr-2 h-4 w-4" />
              Return
            </Button>
          </div>
        </FormField>
        <FormField
          label={decision === SubmissionStatus.Returned ? 'Reason for return' : 'Review note (optional)'}
          htmlFor="review-reason"
          required={decision === SubmissionStatus.Returned}
        >
          <Textarea
            id="review-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              decision === SubmissionStatus.Returned
                ? 'Explain what the client should revise…'
                : 'Add an optional note…'
            }
            rows={4}
            disabled={review.isPending}
          />
        </FormField>
      </form>
    </FormDialog>
  );
}

export function RequestSubmissionsTab({
  requestId,
  canRespond,
  canReview,
  enabled = true,
}: RequestSubmissionsTabProps) {
  const submissions = useSubmissions(requestId, enabled);
  const reviews = useReviewsList(
    `requestId=${requestId}&status=ForReview&pageSize=1`,
    enabled,
  );
  const [respondOpen, setRespondOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const items = submissions.data?.data ?? [];
  const latestIsPending = items[0]?.status === SubmissionStatus.Pending;
  const metricCounts = countsFromSubmissions(
    items,
    reviews.data?.meta.total ?? 0,
  );

  return (
    <div className="space-y-4">
      <SubmissionMetricCards counts={metricCounts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Client responses</h2>
            {latestIsPending ? (
              <Badge variant="secondary">
                <IconClock className="mr-1 h-3 w-3" />
                Latest awaiting review
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Responses and review decisions for this request
          </p>
        </div>
        {canRespond ? (
          <Button type="button" size="sm" onClick={() => setRespondOpen(true)}>
            <IconMessageReply className="mr-2 h-4 w-4" />
            Send response
          </Button>
        ) : null}
      </div>

      {submissions.isPending ? (
        <p className="text-sm text-muted-foreground">Loading responses…</p>
      ) : submissions.isError ? (
        <p className="text-sm text-destructive">Failed to load responses.</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium">No responses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canRespond
              ? 'Send a response when the requested information is ready.'
              : 'Client responses will appear here for review.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((submission, index) => (
            <article key={submission.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {submission.submittedByName || 'Client response'}
                    </p>
                    <Badge variant={statusVariant(submission.status)}>
                      {submission.status}
                    </Badge>
                    {index === 0 ? <Badge variant="outline">Latest</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(submission.createdAt).toLocaleString()}
                  </p>
                </div>
                {canReview && submission.status === SubmissionStatus.Pending ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReviewing(submission)}
                  >
                    Review
                  </Button>
                ) : null}
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{submission.message}</p>

              {submission.files.length > 0 ? (
                <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                  {submission.files.map((file) => (
                    <li
                      key={file.id}
                      className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
                    >
                      <FileTypeIcon
                        fileName={file.fileName}
                        mimeType={file.mimeType}
                        size={18}
                      />
                      <span className="truncate text-foreground">{file.fileName}</span>
                      {formatBytes(file.sizeBytes) ? (
                        <span className="shrink-0 text-xs">({formatBytes(file.sizeBytes)})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {submission.reviewReason ? (
                <div className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">
                    {submission.status === SubmissionStatus.Returned
                      ? 'Reason for return'
                      : 'Review note'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{submission.reviewReason}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {canRespond ? (
        <RespondDialog
          requestId={requestId}
          open={respondOpen}
          onOpenChange={setRespondOpen}
        />
      ) : null}
      {canReview ? (
        <ReviewDialog
          requestId={requestId}
          submission={reviewing}
          onOpenChange={(open) => {
            if (!open) setReviewing(null);
          }}
        />
      ) : null}
    </div>
  );
}
