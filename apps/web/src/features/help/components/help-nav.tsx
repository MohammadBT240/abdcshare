'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconShieldCheck } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useHelpCategories } from '../hooks/use-help';
import { HelpCategoryIcon } from './help-icons';

/** Left-hand docs navigation: every category the viewer can see, with its articles. */
export function HelpNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const categories = useHelpCategories();

  if (categories.isPending) {
    return (
      <div className="space-y-2" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (!categories.data?.length) return null;

  const item = (href: string, label: string, extra?: React.ReactNode) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] leading-snug transition-colors',
          active
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {extra}
        <span className="min-w-0">{label}</span>
      </Link>
    );
  };

  const rolesLink = item('/help/who-can-do-what', 'Who can do what', <IconShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />);
  const hasReference = categories.data.some((c) => c.slug === 'reference');

  return (
    <nav aria-label="Help topics" className="space-y-5 text-sm">
      {categories.data.map((c) => (
        <div key={c.id}>
          <p className="mb-1.5 flex items-center gap-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-foreground/80">
            <HelpCategoryIcon name={c.icon} className="h-3.5 w-3.5 text-primary" />
            {c.name}
          </p>
          <ul className="space-y-0.5">
            {c.articles.map((a) => (
              <li key={a.id}>{item(`/help/${a.slug}`, a.title)}</li>
            ))}
            {c.slug === 'reference' ? <li>{rolesLink}</li> : null}
          </ul>
        </div>
      ))}
      {hasReference ? null : (
        <div>
          <p className="mb-1.5 px-2.5 text-xs font-semibold uppercase tracking-wide text-foreground/80">Reference</p>
          {rolesLink}
        </div>
      )}
    </nav>
  );
}
