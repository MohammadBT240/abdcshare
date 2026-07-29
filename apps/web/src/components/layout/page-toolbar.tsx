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
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 space-y-1">
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
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
