'use client';

import { useMemo, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function summarizeRollups(rollups: ClassRollup[]) {
  let done = 0;
  let total = 0;
  let overdue = 0;
  for (const rc of rollups) {
    done += rc.done;
    total += rc.total;
    overdue += rc.overdue;
  }
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, overdue, progressPercent };
}

export function ClassFilterRail({
  rollups,
  selectedClassId,
  onSelect,
  canAddClass,
  onAddClass,
}: ClassFilterRailProps) {
  const [query, setQuery] = useState('');
  const allSummary = summarizeRollups(rollups);

  const filteredRollups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rollups.filter((rc) => rc.name.toLowerCase().includes(q))
      : [...rollups];
    filtered.sort((a, b) => {
      const aEmpty = a.total === 0 ? 1 : 0;
      const bEmpty = b.total === 0 ? 1 : 0;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      return a.name.localeCompare(b.name);
    });
    return filtered;
  }, [rollups, query]);

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

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search classes…"
          className="h-8 pl-8 text-xs"
          aria-label="Search request classes"
        />
      </div>

      <nav className="space-y-1" aria-label="Request classes">
        <button
          type="button"
          onClick={() => onSelect('all')}
          className={cn(
            'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
            selectedClassId === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-foreground',
          )}
        >
          <span className="font-medium">All classes</span>
          {allSummary.total > 0 ? (
            <p
              className={cn(
                'mt-1 text-[11px]',
                selectedClassId === 'all'
                  ? 'text-primary-foreground/80'
                  : 'text-muted-foreground',
              )}
            >
              {allSummary.progressPercent}% · {allSummary.done}/{allSummary.total}{' '}
              done
              {allSummary.overdue > 0 ? ` · ${allSummary.overdue} overdue` : ''}
            </p>
          ) : (
            <p
              className={cn(
                'mt-1 text-[11px]',
                selectedClassId === 'all'
                  ? 'text-primary-foreground/80'
                  : 'text-muted-foreground',
              )}
            >
              No requests yet
            </p>
          )}
        </button>

        <div className="max-h-[min(70vh,36rem)] space-y-1 overflow-y-auto pr-1">
          {filteredRollups.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matching classes</p>
          ) : (
            filteredRollups.map((rc) => {
              const active = selectedClassId === rc.requestClassId;
              const empty = rc.total === 0;
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
                  {empty ? (
                    <div className="flex items-center justify-between gap-2">
                      <span
                        title={rc.name}
                        className={cn(
                          'truncate text-sm font-medium',
                          active && 'text-primary',
                        )}
                      >
                        {rc.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                        0
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          title={rc.name}
                          className={cn(
                            'truncate text-sm font-medium',
                            active && 'text-primary',
                          )}
                        >
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
                        {rc.progressPercent}% · {rc.done}/{rc.total} done
                        {rc.overdue > 0 ? ` · ${rc.overdue} overdue` : ''}
                      </p>
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      </nav>
    </div>
  );
}
