import { cn } from '@/lib/utils';

/** Compact filter/tooling row — search/pills left, actions right (Tailux toolbar). */
export function FilterBar({
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  /** Optional trailing actions (e.g. Export / View) aligned to the end when space allows. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-2', className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
