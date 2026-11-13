import type { LibraryLicence, LibraryReportOutcome, LibraryReportReason } from '@/features/library/types';

export const LICENCE_OPTIONS: { value: LibraryLicence; label: string; hint: string }[] = [
  { value: 'InternalUseOnly', label: 'Internal use only', hint: 'For staff of the firm. The default.' },
  { value: 'Licensed', label: 'Licensed material', hint: 'Bought or subscribed — do not share outside the firm.' },
  { value: 'FreeToShare', label: 'Free to share', hint: 'Public material that may be shared with clients.' },
];

export function licenceLabel(licence: LibraryLicence): string {
  return LICENCE_OPTIONS.find((o) => o.value === licence)?.label ?? licence;
}

/** D22 — stated plainly wherever view-only is set or shown. */
export const VIEW_ONLY_LIMIT = "View-only discourages copying; it can't prevent screenshots.";

/** D18 wording (mirrors the API's LIBRARY_DECLARATION_TEXT). */
export const DECLARATION_TEXT =
  'This file contains no client-identifiable information, or I have restricted it to the right departments.';

export const REPORT_REASONS: { value: LibraryReportReason; label: string; hint: string }[] = [
  { value: 'ClientConfidential', label: 'Client-confidential information', hint: 'Names a client, or contains client data.' },
  { value: 'Copyright', label: 'Copyright or licence problem', hint: "We may not be allowed to share it." },
  { value: 'OutdatedOrWrong', label: 'Out of date or wrong', hint: 'Superseded, or contains errors.' },
  { value: 'Inappropriate', label: 'Inappropriate', hint: "Doesn't belong in a work library." },
  { value: 'Other', label: 'Something else', hint: 'Tell the curators in the note.' },
];

export function reportReasonLabel(reason: LibraryReportReason): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export const OUTCOME_LABEL: Record<LibraryReportOutcome, string> = {
  Dismiss: 'Dismissed',
  Restrict: 'Restricted to departments',
  Archive: 'Archived',
  Delete: 'Deleted',
};
