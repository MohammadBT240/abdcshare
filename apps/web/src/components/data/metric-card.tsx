'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  /** Rendered beside the value (e.g. colored trend arrow). */
  valueAccessory?: ReactNode;
  children?: ReactNode;
  valueClass?: string;
  className?: string;
  /** Path under `/public`, e.g. `/illustrations/easy/1.svg` */
  illustration?: string;
  /** Optional dark-mode illustration; falls back to `illustration`. */
  illustrationDark?: string;
  /** Watermark size in px (default 72). */
  illustrationSize?: number;
}

/**
 * Compact metric tile with an optional soft watermark illustration
 * (from `/public/illustrations`) so cards don’t read as empty white boxes.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  valueAccessory,
  children,
  valueClass,
  className,
  illustration,
  illustrationDark,
  illustrationSize = 72,
}: MetricCardProps) {
  const darkSrc = illustrationDark ?? illustration;
  const sizeStyle = { width: illustrationSize, height: illustrationSize };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-border bg-card px-3 py-2.5 shadow-sm',
        className,
      )}
    >
      {illustration ? (
        <>
          <Image
            src={illustration}
            alt=""
            width={illustrationSize}
            height={illustrationSize}
            unoptimized
            aria-hidden
            style={sizeStyle}
            className={cn(
              'pointer-events-none absolute -bottom-1 -right-1 select-none object-contain opacity-[0.32]',
              darkSrc && darkSrc !== illustration ? 'dark:hidden' : 'dark:opacity-[0.2]',
            )}
          />
          {darkSrc && darkSrc !== illustration ? (
            <Image
              src={darkSrc}
              alt=""
              width={illustrationSize}
              height={illustrationSize}
              unoptimized
              aria-hidden
              style={sizeStyle}
              className="pointer-events-none absolute -bottom-1 -right-1 hidden select-none object-contain opacity-[0.22] dark:block"
            />
          ) : null}
        </>
      ) : null}

      <div className="relative z-[1] min-w-0 pr-8">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {icon}
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className={cn('text-xl font-semibold tabular-nums', valueClass)}>{value}</p>
          {valueAccessory}
        </div>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
        {children}
      </div>
    </div>
  );
}
