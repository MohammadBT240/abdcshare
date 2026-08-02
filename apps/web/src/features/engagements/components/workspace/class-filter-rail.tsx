'use client';

import { IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ClassRollup } from '@/features/engagements/hooks/use-engagements';

interface ClassFilterRailProps {
  rollups: ClassRollup[];
  selectedClassId: number | 'all';
  onSelect: (id: number | 'all') => void;
  canAddClass?: boolean;
  onAddClass?: () => void;
}

export function ClassFilterRail({
  rollups,
  selectedClassId,
  onSelect,
  canAddClass,
  onAddClass,
}: ClassFilterRailProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Classes
        </p>
        {canAddClass && onAddClass ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onAddClass}
          >
            <IconPlus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        ) : null}
      </div>

      <nav className="space-y-1" aria-label="Request classes">
        <button
          type="button"
          onClick={() => onSelect('all')}
          className={cn(
            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
            selectedClassId === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-foreground',
          )}
        >
          <span className="font-medium">All classes</span>
        </button>
        {rollups.map((rc) => {
          const active = selectedClassId === rc.requestClassId;
          return (
            <button
              key={rc.requestClassId}
              type="button"
              onClick={() => onSelect(rc.requestClassId)}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left transition-colors',
                active ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted',
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={cn('truncate text-sm font-medium', active && 'text-primary')}>
                  {rc.name}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[10px] font-medium uppercase',
                    rc.signedOff ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {rc.signedOff ? 'Signed' : 'Open'}
                </span>
              </div>
              <Progress value={rc.progressPercent} className="h-1" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {rc.done}/{rc.total}
                {rc.overdue > 0 ? ` · ${rc.overdue} overdue` : ''}
              </p>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
