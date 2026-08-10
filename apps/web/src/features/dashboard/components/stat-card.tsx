'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

export type StatTone = 'green' | 'red' | 'amber' | 'sky' | 'violet' | 'slate';

const CHIP_TONES: Record<StatTone, string> = {
  green: 'bg-primary/10 text-primary',
  red: 'bg-destructive/10 text-destructive',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  slate: 'bg-muted text-muted-foreground',
};

const SURFACE_TONES: Record<StatTone, string> = {
  green: 'bg-gradient-to-br from-primary/[0.09] via-card to-card',
  red: 'bg-gradient-to-br from-destructive/[0.08] via-card to-card',
  amber: 'bg-gradient-to-br from-amber-500/[0.1] via-card to-card',
  sky: 'bg-gradient-to-br from-sky-500/[0.1] via-card to-card',
  violet: 'bg-gradient-to-br from-violet-500/[0.08] via-card to-card',
  slate: 'bg-gradient-to-br from-muted/80 via-card to-card',
};

/** Metric tile with optional soft tint + watermark illustration. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'green',
  href,
  alert = false,
  illustration,
  illustrationDark,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: StatTone;
  href?: string;
  alert?: boolean;
  /** Path under `/public`, e.g. `/illustrations/easy/5.svg` */
  illustration?: string;
  illustrationDark?: string;
  className?: string;
}) {
  const darkSrc = illustrationDark ?? illustration;

  const body = (
    <div
      className={cn(
        'relative flex h-full min-h-[6.25rem] w-full min-w-0 items-start justify-between gap-1.5 overflow-hidden rounded-xl border border-border p-3 shadow-sm transition-shadow sm:min-h-[7.25rem] sm:gap-2 sm:p-4',
        SURFACE_TONES[tone],
        href && 'hover:shadow-md',
        className,
      )}
    >
      {illustration ? (
        <>
          <Image
            src={illustration}
            alt=""
            width={72}
            height={72}
            unoptimized
            aria-hidden
            className={cn(
              'pointer-events-none absolute -bottom-3 -right-3 size-16 select-none object-contain opacity-[0.3] sm:-bottom-2 sm:-right-2 sm:size-20 sm:opacity-[0.34]',
              darkSrc && darkSrc !== illustration ? 'dark:hidden' : 'dark:opacity-[0.2]',
            )}
          />
          {darkSrc && darkSrc !== illustration ? (
            <Image
              src={darkSrc}
              alt=""
              width={72}
              height={72}
              unoptimized
              aria-hidden
              className="pointer-events-none absolute -bottom-3 -right-3 hidden size-16 select-none object-contain opacity-[0.22] dark:block sm:-bottom-2 sm:-right-2 sm:size-20"
            />
          ) : null}
        </>
      ) : null}

      <div className="relative z-[1] min-w-0 flex-1 pr-1">
        <p className="line-clamp-2 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </p>
        <p
          className={cn(
            'mt-1 text-2xl font-bold tabular-nums tracking-tight sm:mt-1.5 sm:text-3xl',
            alert && 'text-destructive',
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">
            {hint}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          'relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full sm:size-10',
          CHIP_TONES[tone],
        )}
      >
        <Icon className="size-3.5 sm:size-5" />
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full w-full min-w-0">
        {body}
      </Link>
    );
  }
  return body;
}
