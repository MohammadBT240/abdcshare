'use client';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';

function formatLong(date: Date): string {
  return format(date, 'dd MMM yyyy');
}

export interface DualDateCellProps {
  start?: string | Date | null;
  deadline?: string | Date | null;
  className?: string;
}

/** Start date + Deadline line (Tailux started-date column). */
export function DualDateCell({ start, deadline, className }: DualDateCellProps) {
  const startDate = start ? new Date(start) : null;
  const deadlineDate = deadline ? new Date(deadline) : null;
  const startValid = startDate && !Number.isNaN(startDate.getTime());
  const deadlineValid = deadlineDate && !Number.isNaN(deadlineDate.getTime());

  if (!startValid && !deadlineValid) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className={cn('min-w-[7.5rem] text-sm leading-snug', className)}>
      <div className="font-medium text-foreground">
        {startValid ? formatLong(startDate) : '—'}
      </div>
      {deadlineValid ? (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-amber-600 dark:text-amber-400">Deadline:</span>{' '}
          <span className="text-foreground/90">{formatLong(deadlineDate)}</span>
        </div>
      ) : null}
    </div>
  );
}
