/** Seeded done statuses plus common aliases (case-insensitive substring). */
const DONE_EXACT = new Set(['accepted', 'closed']);

/** Canonical seeded request-stage names (sortOrder 0–3). */
export const REQUEST_STAGE = {
  NotStarted: 'Not Started',
  InProgress: 'In Progress',
  Submitted: 'Submitted',
  Reviewed: 'Reviewed',
} as const;

export type RequestStageName =
  (typeof REQUEST_STAGE)[keyof typeof REQUEST_STAGE];

export function isRequestDone(statusName: string | null | undefined): boolean {
  if (statusName == null || statusName === '') return false;
  const s = statusName.toLowerCase();
  if (DONE_EXACT.has(s)) return true;
  return s.includes('complete') || s.includes('done');
}

/** Start of the local calendar day for `d`. */
export function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Overdue when due date is before today (calendar day) and the request is not done.
 * Due today is not overdue.
 */
export function isRequestOverdue(
  dueDate: Date | string | null | undefined,
  statusName: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate || isRequestDone(statusName)) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return startOfLocalDay(due).getTime() < startOfLocalDay(now).getTime();
}

export function computeRequestProgressPercent(
  expectedDocumentCount: number,
  acceptedFileCount: number,
  _statusName?: string | null,
): number {
  const expected = Math.max(1, expectedDocumentCount || 1);
  return Math.min(100, Math.round((acceptedFileCount / expected) * 100));
}

export type ProgressWeightItem = {
  expectedDocumentCount: number;
  acceptedFileCount: number;
  statusName: string | null | undefined;
};

/**
 * Engagement / class completion from request status (equal weight per request).
 * Done statuses (Accepted/Closed/…) count as complete; document delivery is ignored.
 */
export function statusProgressPercent(
  items: Array<{ statusName: string | null | undefined }>,
): number {
  if (items.length === 0) return 0;
  let done = 0;
  for (const item of items) {
    if (isRequestDone(item.statusName)) done += 1;
  }
  return Math.min(100, Math.round((done / items.length) * 100));
}

/**
 * Weighted document-delivery progress across requests (status ignored).
 * Prefer {@link statusProgressPercent} for engagement/class rollups.
 */
export function weightedProgressPercent(items: ProgressWeightItem[]): number {
  if (items.length === 0) return 0;
  let sumAccepted = 0;
  let sumExpected = 0;
  for (const item of items) {
    const expected = Math.max(1, item.expectedDocumentCount || 1);
    sumExpected += expected;
    sumAccepted += Math.min(expected, Math.max(0, item.acceptedFileCount || 0));
  }
  if (sumExpected === 0) return 0;
  return Math.min(100, Math.round((sumAccepted / sumExpected) * 100));
}

export type InferRequestStageInput = {
  statusName: string | null | undefined;
  expectedDocumentCount: number;
  acceptedFileCount: number;
  /** At least one non-draft client submission exists. */
  hasNonDraftSubmission: boolean;
  /**
   * Staff has touched files (UnderReview / Returned / Accepted) or a submission
   * is already Accepted/Returned.
   */
  hasStaffReviewActivity: boolean;
};

/**
 * Derive request stage from delivery/review activity (not manually set).
 *
 * Reviewed — request done, or enough files accepted vs expected
 * Not Started — no client response yet
 * Submitted — client sent work; staff has not started reviewing
 * In Progress — staff reviewing / returned / partially accepted
 */
export function inferRequestStageName(
  input: InferRequestStageInput,
): RequestStageName {
  const expected = Math.max(1, input.expectedDocumentCount || 1);
  if (
    isRequestDone(input.statusName) ||
    input.acceptedFileCount >= expected
  ) {
    return REQUEST_STAGE.Reviewed;
  }
  if (!input.hasNonDraftSubmission) {
    return REQUEST_STAGE.NotStarted;
  }
  if (input.hasStaffReviewActivity) {
    return REQUEST_STAGE.InProgress;
  }
  return REQUEST_STAGE.Submitted;
}
