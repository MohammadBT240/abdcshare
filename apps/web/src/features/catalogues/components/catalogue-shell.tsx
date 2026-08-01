'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Card } from '@/components/ui/card';
import {
  CATALOGUE_SECTIONS,
  isCatalogueSectionActive,
} from '@/features/catalogues/catalogue-sections';
import { cn } from '@/lib/utils';

interface CatalogueShellProps {
  children: React.ReactNode;
}

function sectionLinkClass(active: boolean, variant: 'mobile' | 'desktop'): string {
  if (variant === 'mobile') {
    return cn(
      'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
      active
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    );
  }
  return cn(
    'relative block px-4 py-2.5 text-sm transition-colors',
    active
      ? 'bg-primary/5 font-medium text-primary'
      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
    active &&
      'before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-primary',
  );
}

export function CatalogueShell({ children }: CatalogueShellProps) {
  const pathname = usePathname();

  return (
    <div>
      <PageToolbar
        title="Catalogues"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Admin' },
          { label: 'Catalogues' },
        ]}
        description="Manage reference catalogues used across engagements and requests"
      />

      <Card className="overflow-hidden border-border shadow-aca">
        {/* Mobile: horizontal scroll tabs */}
        <nav
          className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 lg:hidden"
          aria-label="Catalogue sections"
        >
          {CATALOGUE_SECTIONS.map((item) => {
            const active = isCatalogueSectionActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={sectionLinkClass(active, 'mobile')}
                aria-current={active ? 'page' : undefined}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-h-[28rem]">
          {/* Desktop: vertical side tabs */}
          <nav
            className="hidden w-52 shrink-0 flex-col border-r border-border bg-muted/20 py-3 lg:flex"
            aria-label="Catalogue sections"
          >
            {CATALOGUE_SECTIONS.map((item) => {
              const active = isCatalogueSectionActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={sectionLinkClass(active, 'desktop')}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">{children}</div>
        </div>
      </Card>
    </div>
  );
}
