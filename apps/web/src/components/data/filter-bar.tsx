import { cn } from '@/lib/utils';

/** Compact filter/tooling row — controls sit side-by-side and wrap when needed. */
export function FilterBar({
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  /** Optional trailing actions (e.g. Export) aligned to the end when space allows. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-2', className)}>
      {children}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
