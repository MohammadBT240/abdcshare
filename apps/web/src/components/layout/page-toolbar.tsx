import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageToolbarProps {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  /** breadcrumbs (+ optional actions) only — no page title block */
  variant?: 'default' | 'compact';
  hideTitle?: boolean;
}

export function PageToolbar({
  title,
  breadcrumbs,
  description,
  actions,
  className,
  variant = 'default',
  hideTitle = false,
}: PageToolbarProps) {
  const compact = variant === 'compact' || hideTitle;
  const showTitle = !compact && Boolean(title);

  return (
    <div
      className={cn(
        compact ? 'mb-2 space-y-1.5 sm:mb-3' : 'mb-4 space-y-2 sm:mb-6',
        className,
      )}
    >
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

      {showTitle || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {showTitle ? (
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
                {title}
              </h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          {actions ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
