import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageToolbarProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageToolbar({ title, breadcrumbs, description, actions, className }: PageToolbarProps) {
  return (
    <div className={cn('mb-4 space-y-2 sm:mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((item, i) => (
            <span key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden>-</span> : null}
              {item.href ? (
                <Link href={item.href} className="hover:text-primary hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
