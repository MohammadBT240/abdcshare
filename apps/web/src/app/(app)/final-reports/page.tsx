'use client';

import { Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { IconArrowRight } from '@tabler/icons-react';
import {
  DataTable,
  StatusPill,
  formatStatusLabel,
  resolveStatusTone,
  useListParams,
} from '@/components/data';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type ClientPendingReport,
  type ReportReviewState,
  useClientFinalReports,
} from '@/features/report-reviews/hooks/use-report-reviews';

type ClientFilter = 'pending' | 'all';

function formatSentAt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function clientReviewLabel(state: ReportReviewState): string {
  switch (state) {
    case 'AwaitingClient':
      return 'Awaiting your response';
    case 'ChangesRequested':
      return 'Changes requested';
    case 'Approved':
      return 'Approved';
    case 'Overridden':
      return 'Issued';
    case 'Locked':
      return 'Locked';
    default:
      return formatStatusLabel(state);
  }
}

function FinalReportsInner() {
  const router = useRouter();
  const { params, setParams, queryString } = useListParams({ pageSize: 20 });
  const state = (params.extra.state as ClientFilter) || 'pending';
  const listQuery = useMemo(() => {
    const sp = new URLSearchParams(queryString);
    if (!sp.get('state')) sp.set('state', 'pending');
    return sp.toString();
  }, [queryString]);
  const reports = useClientFinalReports(listQuery);

  const columns = useMemo<ColumnDef<ClientPendingReport, unknown>[]>(
    () => [
      {
        header: 'Report',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.title}</p>
            {row.original.fileName ? (
              <p className="truncate text-xs text-muted-foreground">{row.original.fileName}</p>
            ) : null}
          </div>
        ),
      },
      {
        header: 'Engagement',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.engagementReferenceCode}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.engagementTitle}
            </p>
          </div>
        ),
      },
      {
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={resolveStatusTone(row.original.reviewState)}>
            {clientReviewLabel(row.original.reviewState)}
          </StatusPill>
        ),
      },
      {
        header: 'Cycle',
        cell: ({ row }) => `Round ${row.original.reviewRound}`,
      },
      {
        header: 'Version',
        cell: ({ row }) => `v${row.original.currentVersion}`,
      },
      {
        header: 'Sent',
        cell: ({ row }) => formatSentAt(row.original.sentAt),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const awaiting = row.original.reviewState === 'AwaitingClient';
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/final-reports/${row.original.documentId}`);
              }}
            >
              {awaiting ? 'Review' : 'Open'}
              <IconArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          );
        },
      },
    ],
    [router],
  );

  return (
    <div className="space-y-5">
      <PageToolbar
        title="Final reports"
        description={
          state === 'pending'
            ? 'Draft reports awaiting your approval or feedback'
            : 'All final reports shared with you for this engagement'
        }
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Final reports' }]}
      />

      <Tabs
        value={state}
        onValueChange={(value) =>
          setParams({ page: 1, extra: { state: value === 'pending' ? undefined : value } })
        }
      >
        <TabsList>
          <TabsTrigger value="pending">Needs your response</TabsTrigger>
          <TabsTrigger value="all">All reports</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={reports.data?.data ?? []}
        meta={reports.data?.meta}
        isPending={reports.isPending || reports.isFetching}
        error={reports.isError ? 'Failed to load final reports' : null}
        onPageChange={(page) => setParams({ page })}
        onRowClick={(report) => router.push(`/final-reports/${report.documentId}`)}
        emptyMessage={
          state === 'pending'
            ? 'No final reports are awaiting your response'
            : 'No final reports have been shared with you yet'
        }
      />
    </div>
  );
}

export default function FinalReportsPage() {
  return (
    <Suspense fallback={<DataTableSkeleton columns={6} />}>
      <FinalReportsInner />
    </Suspense>
  );
}
