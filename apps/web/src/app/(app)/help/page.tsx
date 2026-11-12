'use client';

import Link from 'next/link';
import { IconArrowRight, IconSettings, IconShieldCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/data/empty-state';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { HelpCategoryIcon } from '@/features/help/components/help-icons';
import { HelpSearch } from '@/features/help/components/help-search';
import { useHelpCategories } from '@/features/help/hooks/use-help';

const PREVIEW = 6;

export default function HelpHomePage() {
  const categories = useHelpCategories();
  const { can } = useAuth();

  return (
    <div className="pb-16">
      <section className="relative -mx-1 mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-5 py-10 text-center sm:px-10 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">How can we help?</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Step-by-step guides for everything you can do in the portal — written for your role.
        </p>
        <div className="mt-6">
          <HelpSearch variant="hero" />
        </div>
        {can('help:manage') ? (
          <Button asChild variant="ghost" size="sm" className="absolute right-3 top-3 text-muted-foreground">
            <Link href="/admin/help">
              <IconSettings className="mr-1.5 h-4 w-4" aria-hidden /> Manage
            </Link>
          </Button>
        ) : null}
      </section>

      {categories.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : categories.isError ? (
        <ErrorState message="Failed to load help topics" />
      ) : categories.data.length === 0 ? (
        <EmptyState message="No help articles are available yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="help-categories">
          {categories.data.map((c) => (
            <section
              key={c.id}
              id={c.slug}
              aria-labelledby={`cat-${c.slug}`}
              className="flex scroll-mt-20 flex-col rounded-xl border border-border bg-card p-5 shadow-aca"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HelpCategoryIcon name={c.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id={`cat-${c.slug}`} className="font-semibold text-foreground">
                    {c.name}
                  </h2>
                  {c.description ? <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p> : null}
                </div>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {c.articles.slice(0, PREVIEW).map((a) => (
                  <li key={a.id}>
                    <Link href={`/help/${a.slug}`} className="group flex items-start gap-1.5 text-foreground hover:text-primary">
                      <IconArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                      <span>{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {c.articles.length > PREVIEW ? (
                <details className="mt-1.5 text-sm">
                  <summary className="cursor-pointer list-none pl-5 text-primary hover:underline">
                    {c.articles.length - PREVIEW} more
                  </summary>
                  <ul className="mt-1.5 space-y-1.5">
                    {c.articles.slice(PREVIEW).map((a) => (
                      <li key={a.id}>
                        <Link href={`/help/${a.slug}`} className="group flex items-start gap-1.5 text-foreground hover:text-primary">
                          <IconArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                          <span>{a.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          ))}
          <Link
            href="/help/who-can-do-what"
            className="flex flex-col justify-between rounded-xl border border-dashed border-border bg-card/60 p-5 hover:border-primary/50 hover:bg-card"
          >
            <span className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold text-foreground">Who can do what</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Every role and what it’s allowed to do — always up to date with the app.
                </span>
              </span>
            </span>
            <span className="mt-4 text-sm font-medium text-primary">Open the table →</span>
          </Link>
        </div>
      )}
    </div>
  );
}
