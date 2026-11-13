'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconArrowLeft, IconArrowRight, IconChevronRight, IconClock, IconPencil, IconUsers } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/data/empty-state';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ArticleBody } from '@/features/help/components/article-body';
import { ArticleFeedback } from '@/features/help/components/article-feedback';
import { ArticleToc } from '@/features/help/components/article-toc';
import { useHelpArticle, useHelpCategories } from '@/features/help/hooks/use-help';
import { withHeadingIds, type PMNode } from '@/features/help/lib/doc-outline';

const ROLE_LABEL: Record<string, string> = { Partner: 'Partners', PrincipalPartner: 'Principal Partner' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = useHelpArticle(slug);
  const categories = useHelpCategories();
  const { can } = useAuth();
  const data = article.data;

  const outline = useMemo(() => (data ? withHeadingIds(data.bodyJson as unknown as PMNode).outline : []), [data]);

  // Previous / next across the whole help center, in sidebar order.
  const { prev, next } = useMemo(() => {
    const flat = (categories.data ?? []).flatMap((c) => c.articles);
    const i = flat.findIndex((a) => a.slug === slug);
    return { prev: i > 0 ? flat[i - 1] : undefined, next: i >= 0 ? flat[i + 1] : undefined };
  }, [categories.data, slug]);

  // Honour #section links once the body is in the DOM.
  useEffect(() => {
    if (!data || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [data]);

  useEffect(() => {
    if (data) document.title = `${data.title} · Help`;
  }, [data]);

  if (article.isPending) {
    return (
      <div className="max-w-3xl space-y-4" aria-busy>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (article.isError || !data) {
    return (
      <div className="max-w-3xl">
        <EmptyState message="This article isn't available — it may have been moved, or it isn't meant for your role." />
        <p className="text-center">
          <Link href="/help" className="text-sm font-medium text-primary hover:underline">
            Back to the Help Center
          </Link>
        </p>
      </div>
    );
  }

  const audience = data.visibleToRoles.map((r) => ROLE_LABEL[r] ?? r);

  return (
    <div className="grid gap-10 pb-16 xl:grid-cols-[minmax(0,1fr)_13.5rem]">
      <article className="min-w-0 max-w-3xl" data-testid="help-article">
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/help" className="hover:text-primary hover:underline">
            Help Center
          </Link>
          {data.category ? (
            <>
              <IconChevronRight className="h-3 w-3" aria-hidden />
              <Link href={`/help#${data.category.slug}`} className="hover:text-primary hover:underline">
                {data.category.name}
              </Link>
            </>
          ) : null}
        </nav>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight">{data.title}</h1>
        {data.summary ? <p className="mt-2 text-base leading-relaxed text-muted-foreground">{data.summary}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <IconUsers className="h-3.5 w-3.5" aria-hidden />
            {audience.length ? (
              <>
                For{' '}
                {audience.map((r) => (
                  <Badge key={r} variant="secondary" className="font-normal">
                    {r}
                  </Badge>
                ))}
              </>
            ) : (
              'For everyone'
            )}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconClock className="h-3.5 w-3.5" aria-hidden /> Updated {formatDate(data.updatedAt)}
          </span>
          {can('help:manage') ? (
            <span className="inline-flex items-center gap-2">
              {data.status !== 'published' ? <Badge variant="outline">Draft</Badge> : null}
              {data.edited ? <Badge variant="outline">Edited in app</Badge> : null}
              <Link href={`/admin/help/articles/${data.id}/edit`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <IconPencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </Link>
            </span>
          ) : null}
        </div>

        {outline.length >= 3 ? (
          <details className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-2 xl:hidden">
            <summary className="cursor-pointer text-sm font-medium text-foreground">On this page</summary>
            <ArticleToc outline={outline} className="mt-2 pb-1 [&>p]:hidden" />
          </details>
        ) : null}

        <ArticleBody bodyJson={data.bodyJson} className="mt-6" />

        {data.related && data.related.length > 0 ? (
          <section className="mt-10" aria-labelledby="related-heading">
            <h2 id="related-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/80">
              Related articles
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.related.map((r) => (
                <li key={r.id}>
                  <Link href={`/help/${r.slug}`} className="block h-full rounded-lg border border-border bg-card p-3 hover:border-primary/50">
                    <span className="block text-sm font-medium text-foreground">{r.title}</span>
                    {r.summary ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{r.summary}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10">
          <ArticleFeedback key={data.slug} slug={data.slug} initial={data.myFeedback} />
        </div>

        {prev || next ? (
          <nav aria-label="More articles" className="mt-8 grid gap-3 sm:grid-cols-2">
            {prev ? (
              <Link href={`/help/${prev.slug}`} className="group rounded-lg border border-border p-3 hover:border-primary/50">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconArrowLeft className="h-3.5 w-3.5" aria-hidden /> Previous
                </span>
                <span className="mt-0.5 block text-sm font-medium text-foreground group-hover:text-primary">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link href={`/help/${next.slug}`} className="group rounded-lg border border-border p-3 text-right hover:border-primary/50">
                <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  Next <IconArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="mt-0.5 block text-sm font-medium text-foreground group-hover:text-primary">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-[4.5rem]">
          <ArticleToc outline={outline} />
        </div>
      </aside>
    </div>
  );
}
