'use client';

import { cn } from '@/lib/utils';

const TONE_CLASS = {
  default: 'border-border bg-muted/40 text-foreground',
  primary: 'border-primary/40 bg-primary/10 text-primary',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  teal: 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  sky: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
} as const;

export type OutlineTagTone = keyof typeof TONE_CLASS;

export interface OutlineTagProps {
  children: React.ReactNode;
  tone?: OutlineTagTone;
  className?: string;
}

/** Outline chip (Tailux tags) using brand-safe tones. */
export function OutlineTag({ children, tone = 'default', className }: OutlineTagProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface OutlineTagListProps {
  tags: Array<{ label: string; tone?: OutlineTagTone }>;
  className?: string;
}

export function OutlineTagList({ tags, className }: OutlineTagListProps) {
  if (tags.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className={cn('flex max-w-[14rem] flex-wrap gap-1', className)}>
      {tags.map((t) => (
        <OutlineTag key={t.label} tone={t.tone}>
          {t.label}
        </OutlineTag>
      ))}
    </div>
  );
}
