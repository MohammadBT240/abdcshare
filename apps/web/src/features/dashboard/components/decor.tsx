'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { IconBellRinging } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Asset map — firm kit under /public                                  */
/* ------------------------------------------------------------------ */

export const DASH_ASSETS = {
  heroBg: '/auth/bg3.jpg',
  heroBgDark: '/auth/bg3-dark.jpg',
  pattern: '/patterns/taieri.svg',
  easy: {
    welcome: '/illustrations/easy/1.svg',
    welcomeDark: '/illustrations/easy/1-dark.svg',
    documents: '/illustrations/easy/2.svg',
    documentsDark: '/illustrations/easy/2-dark.svg',
    team: '/illustrations/easy/3.svg',
    teamDark: '/illustrations/easy/3-dark.svg',
    upload: '/illustrations/easy/4.svg',
    review: '/illustrations/easy/5.svg',
    returned: '/illustrations/easy/6.svg',
    accepted: '/illustrations/easy/7.svg',
    underReview: '/illustrations/easy/8.svg',
    search: '/illustrations/easy/9.svg',
  },
  working: '/illustrations/working.svg',
  folder: '/files/folder-document.svg',
  folderDark: '/files/folder-document-dark.svg',
  pdf: '/files/pdf.svg',
  pdfDark: '/files/pdf-dark.svg',
} as const;

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Photographic hero with a calm brand wash. Pattern accent is kept
 * very light so the greeting stays the focus.
 */
export function DashboardHero({
  name,
  role,
  tagline,
  unread = 0,
  children,
}: {
  name: string;
  role: string;
  tagline: string;
  unread?: number;
  children?: ReactNode;
}) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="relative overflow-hidden rounded-xl text-white shadow-sm">
      <Image
        src={DASH_ASSETS.heroBg}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center dark:hidden"
        aria-hidden
      />
      <Image
        src={DASH_ASSETS.heroBgDark}
        alt=""
        fill
        priority
        sizes="100vw"
        className="hidden object-cover object-center dark:block"
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, hsl(150 55% 10% / 0.94) 0%, hsl(146 50% 15% / 0.88) 55%, hsl(146 42% 18% / 0.82) 100%)',
        }}
      />
      <Image
        src={DASH_ASSETS.pattern}
        alt=""
        width={360}
        height={150}
        unoptimized
        aria-hidden
        className="pointer-events-none absolute -right-10 top-1/2 hidden h-[120%] w-auto -translate-y-1/2 opacity-40 sm:block"
      />

      <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 py-6 sm:px-8">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            {today} · {role}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-[1.7rem]">
            {greetingForNow()}, {name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-white/75">{tagline}</p>
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
              <IconBellRinging className="size-3.5" />
              {unread} unread
            </span>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Compact scene art for banners / empty states only. */
export function SceneArt({
  src,
  darkSrc,
  className,
  size = 88,
}: {
  src: string;
  darkSrc?: string;
  className?: string;
  size?: number;
}) {
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={cn('h-full w-full object-contain', darkSrc ? 'dark:hidden' : undefined)}
      />
      {darkSrc ? (
        <Image
          src={darkSrc}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="hidden h-full w-full object-contain dark:block"
        />
      ) : null}
    </div>
  );
}

/** Quiet callout — soft tint only, no photo/pattern wash. */
export function SceneBanner({
  title,
  description,
  art,
  artDark,
  artSize = 88,
  actions,
  className,
}: {
  title: string;
  description: string;
  art: string;
  artDark?: string;
  artSize?: number;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <SceneArt src={art} darkSrc={artDark} size={artSize} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{description}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({
  illustration,
  illustrationDark,
  title,
  hint,
  className,
}: {
  illustration?: string;
  illustrationDark?: string;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center py-4 text-center', className)}>
      {illustration ? (
        <SceneArt src={illustration} darkSrc={illustrationDark} size={64} />
      ) : null}
      <p className={cn('text-sm font-medium', illustration && 'mt-2')}>{title}</p>
      {hint ? <p className="mt-0.5 max-w-[28ch] text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
