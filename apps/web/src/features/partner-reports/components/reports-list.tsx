'use client';

import { IconChevronRight } from '@tabler/icons-react';
import type { PageMeta } from '@abdcshare/api-client';
import {
  ListPagination,
  StatusPill,
  UserAvatar,
  formatStatusLabel,
  resolveStatusTone,
} from '@/components/data';
import { EmptyState, ErrorState } from '@/components/data/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PartnerReport } from '@/features/partner-reports/hooks/use-partner-reports';

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function departmentLabel(value?: string | null): string | null {
  const t = value?.trim();
  if (!t || /^none$/i.test(t)) return null;
  return t;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`;
}

export function ReportsList({
  rows,
  meta,
  pageSize,
  isPending,
  error,
  emptyMessage,
  onPageChange,
  onRowClick,
}: {
  rows: PartnerReport[];
  meta?: PageMeta;
  pageSize?: number;
  isPending?: boolean;
  error?: string | null;
  emptyMessage: string;
  onPageChange?: (page: number) => void;
  onRowClick: (report: PartnerReport) => void;
}) {
  if (isPending && rows.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ErrorState message={error} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4">
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <ul
        className={cn(
          'divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm',
          isPending && 'opacity-60',
        )}
      >
        {rows.map((report) => {
          const department = departmentLabel(report.department);
          const title = department ?? report.reportingOfficerName;
          const metaBits = [
            department ? report.reportingOfficerName : null,
            formatStatusLabel(report.periodType),
            report.periodLabel?.trim() || null,
            report.isGuest ? 'Guest' : null,
          ].filter(Boolean);

          return (
            <li key={report.id}>
              <button
                type="button"
                onClick={() => onRowClick(report)}
                className="flex w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40 sm:gap-4 sm:px-4 sm:py-3.5"
              >
                <UserAvatar
                  initials={initialsFrom(report.reportingOfficerName)}
                  size="md"
                  className="shrink-0 bg-primary/10 text-primary"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                    <StatusPill tone={resolveStatusTone(report.status)}>
                      {formatStatusLabel(report.status)}
                    </StatusPill>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {metaBits.join(' · ')}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
                    Submitted {formatWhen(report.submittedAt)}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Submitted
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums text-foreground">
                    {formatWhen(report.submittedAt)}
                  </p>
                </div>
                <IconChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
              </button>
            </li>
          );
        })}
      </ul>

      {meta ? (
        <ListPagination
          meta={meta}
          pageSize={pageSize}
          onPageChange={onPageChange}
          isPending={isPending}
        />
      ) : null}
    </div>
  );
}
