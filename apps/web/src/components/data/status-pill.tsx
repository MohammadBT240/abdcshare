'use client';

import { cn } from '@/lib/utils';

const TONE_CLASS = {
  success: 'bg-emerald-600',
  danger: 'bg-red-600',
  warning: 'bg-amber-500',
  info: 'bg-sky-600',
  accent: 'bg-violet-600',
  neutral: 'bg-slate-500',
} as const;

export type StatusPillTone = keyof typeof TONE_CLASS;

export interface StatusPillProps {
  tone?: StatusPillTone;
  children: React.ReactNode;
  className?: string;
}

/** Solid status pill: saturated fill, white text, leading white dot. */
export function StatusPill({ tone = 'neutral', children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Normalize catalogue / enum labels for tone lookup. */
function normalizeStatusKey(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'active' : 'inactive';
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

const TONE_BY_KEY: Record<string, StatusPillTone> = {
  // Active / inactive
  active: 'success',
  inactive: 'neutral',
  true: 'success',
  false: 'neutral',

  // Submission / file
  accepted: 'success',
  returned: 'danger',
  pending: 'warning',
  draft: 'warning',
  underreview: 'accent',

  // Documents
  signedoff: 'success',
  ready: 'warning',

  // Final report / reviews
  approved: 'success',
  locked: 'success',
  changesrequested: 'danger',
  awaitingclient: 'warning',
  notsent: 'warning',
  overridden: 'neutral',
  forreview: 'warning',
  sentback: 'danger',

  // Request catalogue statuses (seed: Open, Pending Client, Accepted, Returned, Closed)
  open: 'info',
  pendingclient: 'warning',
  closed: 'neutral',
  done: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  canceled: 'neutral',
  onhold: 'warning',
  blocked: 'danger',

  // Request stages (when shown as pills)
  notstarted: 'neutral',
  inprogress: 'info',
  submitted: 'warning',
  reviewed: 'accent',
};

/**
 * Resolve a solid-pill tone from a status label or enum value.
 * Unknown values fall back to neutral.
 */
export function resolveStatusTone(labelOrEnum: string | boolean): StatusPillTone {
  const key = normalizeStatusKey(labelOrEnum);
  return TONE_BY_KEY[key] ?? 'neutral';
}

/** Human-friendly label for common enum-ish status keys. */
export function formatStatusLabel(labelOrEnum: string | boolean): string {
  if (typeof labelOrEnum === 'boolean') return labelOrEnum ? 'Active' : 'Inactive';
  const key = normalizeStatusKey(labelOrEnum);
  const LABELS: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    underreview: 'Under review',
    awaitingclient: 'Awaiting client',
    changesrequested: 'Changes requested',
    notsent: 'Not sent',
    forreview: 'For review',
    sentback: 'Sent back',
    signedoff: 'Signed off',
    notstarted: 'Not started',
    inprogress: 'In progress',
    pendingclient: 'Pending client',
    onhold: 'On hold',
  };
  if (LABELS[key]) return LABELS[key];
  // Insert spaces before capitals for PascalCase enums
  const spaced = String(labelOrEnum).replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced;
}
