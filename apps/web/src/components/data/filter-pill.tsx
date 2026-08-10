'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
}

/** Dashed idle / solid primary when active — Tailux-style list filter trigger. */
export const FilterPill = forwardRef<HTMLButtonElement, FilterPillProps>(function FilterPill(
  { active = false, icon, label, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-dashed border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
        className,
      )}
      {...props}
    >
      {icon ? <span className="inline-flex shrink-0 opacity-80">{icon}</span> : null}
      <span className="truncate">{label}</span>
    </button>
  );
});
