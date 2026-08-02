'use client';

import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { MetricCard } from '@/components/data/metric-card';
import { cn } from '@/lib/utils';

export interface SubmissionMetricCounts {
  uploaded: number;
  awaitingReview: number;
  returned: number;
  accepted: number;
  underReview: number;
}

const METRICS: {
  key: keyof SubmissionMetricCounts;
  label: string;
  /** When true, positive counts show ↑ (healthy); otherwise ↓ (queue / issue). */
  upWhenPositive: boolean;
  tone: 'primary' | 'amber' | 'rose' | 'teal';
  illustration: string;
  illustrationDark?: string;
}[] = [
  {
    key: 'uploaded',
    label: 'Uploaded',
    upWhenPositive: true,
    tone: 'primary',
    illustration: '/illustrations/easy/4.svg',
  },
  {
    key: 'awaitingReview',
    label: 'Awaiting review',
    upWhenPositive: false,
    tone: 'amber',
    illustration: '/illustrations/easy/5.svg',
  },
  {
    key: 'returned',
    label: 'Returned',
    upWhenPositive: false,
    tone: 'rose',
    illustration: '/illustrations/easy/6.svg',
  },
  {
    key: 'accepted',
    label: 'Accepted',
    upWhenPositive: true,
    tone: 'primary',
    illustration: '/illustrations/easy/7.svg',
  },
  {
    key: 'underReview',
    label: 'Under review',
    upWhenPositive: false,
    tone: 'teal',
    illustration: '/illustrations/easy/8.svg',
  },
];

const toneClass: Record<(typeof METRICS)[number]['tone'], string> = {
  primary: 'text-emerald-500 dark:text-emerald-400',
  amber: 'text-amber-400 dark:text-amber-300',
  rose: 'text-rose-400 dark:text-rose-300',
  teal: 'text-teal-500 dark:text-teal-300',
};

interface SubmissionMetricCardsProps {
  counts: SubmissionMetricCounts;
  className?: string;
}

/** Status tiles for client docs / submission pipeline. */
export function SubmissionMetricCards({ counts, className }: SubmissionMetricCardsProps) {
  return (
    <ul className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5', className)}>
      {METRICS.map(({ key, label, upWhenPositive, tone, illustration, illustrationDark }) => {
        const value = counts[key];
        const Icon = upWhenPositive ? IconArrowUp : IconArrowDown;
        return (
          <li key={key}>
            <MetricCard
              label={label}
              value={String(value)}
              illustration={illustration}
              illustrationDark={illustrationDark}
              illustrationSize={64}
              valueAccessory={
                <Icon
                  className={cn('h-3.5 w-3.5 shrink-0 fill-current', toneClass[tone])}
                  aria-hidden
                />
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

export function emptySubmissionCounts(): SubmissionMetricCounts {
  return {
    uploaded: 0,
    awaitingReview: 0,
    returned: 0,
    accepted: 0,
    underReview: 0,
  };
}

/** Derive counts from a request's submissions list (+ optional under-review count). */
export function countsFromSubmissions(
  submissions: { status: string; files?: unknown[] }[],
  underReview = 0,
): SubmissionMetricCounts {
  const counts = emptySubmissionCounts();
  counts.underReview = underReview;
  for (const s of submissions) {
    counts.uploaded += s.files?.length ?? 0;
    if (s.status === 'Pending') counts.awaitingReview += 1;
    else if (s.status === 'Returned') counts.returned += 1;
    else if (s.status === 'Accepted') counts.accepted += 1;
  }
  return counts;
}
