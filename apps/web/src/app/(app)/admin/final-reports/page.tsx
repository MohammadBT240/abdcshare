'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import {
  IconArrowRight,
  IconBriefcase,
  IconSearch,
  IconToggleLeft,
} from '@tabler/icons-react';
import {
  ChecklistFilter,
  DataTable,
  FilterBar,
  StatusPill,
  formatStatusLabel,
  resolveStatusTone,
  useListParams,
} from '@/components/data';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEngagementsList } from '@/features/engagements/hooks/use-engagements';
import {
  type FirmReportListItem,
  type ReportReviewState,
  useFirmFinalReports,
} from '@/features/report-reviews/hooks/use-report-reviews';

type FirmFilter = 'needsAction' | 'awaitingClient' | 'all';

const REVIEW_STATE_OPTIONS: Array<{ value: ReportReviewState; label: string }> = [
  { value: 'AwaitingClient', label: 'Awaiting client' },
  { value: 'ChangesRequested', label: 'Changes requested' },
  { value: 'Locked', label: 'Locked' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Overridden', label: 'Issued' },
];

function firmLabel(state: ReportReviewState): string {
  switch (state) {
    case 'AwaitingClient':
      return 'Awaiting client';
    case 'ChangesRequested':
      return 'Changes requested';
    case 'Locked':
      return 'Locked';
    case 'Approved':
      return 'Approved';
    case 'Overridden':
      return 'Issued';
    default:
      return formatStatusLabel(state);
  }
}

function openHref(row: FirmReportListItem): string {
  return `/engagements/${row.engagementId}?tab=documents&category=FinalReport&documentId=${row.documentId}`;
}

function FirmFinalReportsInner() {
  const router = useRouter();
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const state = (params.extra.state as FirmFilter) || 'needsAction';
  const engagements = useEngagementsList('pageSize=100');
  const listQuery = useMemo(() => {
    const sp = new URLSearchParams(queryString);
    if (!sp.get('state')) sp.set('state', 'needsAction');
    return sp.toString();
  }, [queryString]);
  const reports = useFirmFinalReports(listQuery);

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const engagementOptions = useMemo(
    () =>
      (engagements.data?.data ?? []).map((e) => ({
        value: e.id,
        label: `${e.referenceCode} — ${e.title}`,
      })),
    [engagements.data],
  );

  const columns = useMemo<ColumnDef<FirmReportListItem, unknown>[]>(
    () => [
      {
        header: 'Report',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.title}</p>
            {row.original.latestFeedback ? (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.latestFeedback}
              </p>
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
        header: 'State',
        cell: ({ row }) => (
          <StatusPill tone={resolveStatusTone(row.original.reviewState)}>
            {firmLabel(row.original.reviewState)}
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
        header: 'Updated',
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={(event) => {
              event.stopPropagation();
              router.push(openHref(row.original));
            }}
          >
            Open
            <IconArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [router],
  );

  return (
    <div className="space-y-5">
      <PageToolbar
        title="Final report reviews"
        description="Reports needing firm action, awaiting client response, or already in a review cycle"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Final report reviews' },
        ]}
      />
      <Tabs
        value={state}
        onValueChange={(value) => {
          setParams({
            extra: {
              state: value,
              // Exact state filter is independent of the tab preset; clear when switching tabs
              reviewState: undefined,
            },
          });
        }}
      >
        <TabsList>
          <TabsTrigger value="needsAction">Needs firm action</TabsTrigger>
          <TabsTrigger value="awaitingClient">Awaiting client</TabsTrigger>
          <TabsTrigger value="all">All sent</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar>
        <div className="relative min-w-0 flex-1 basis-56 max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => {
              const q = e.target.value;
              setSearchDraft(q);
              setSearchQueryDebounced(q);
            }}
            placeholder="Search title, engagement, feedback…"
            className="h-10 rounded-lg pl-9"
          />
        </div>
        <ChecklistFilter
          label="Engagement"
          icon={<IconBriefcase className="h-4 w-4" />}
          options={engagementOptions}
          value={params.extra.engagementId || undefined}
          onChange={(value) => setParams({ extra: { engagementId: value } })}
          searchPlaceholder="Engagements"
        />
        <ChecklistFilter
          label="Review state"
          icon={<IconToggleLeft className="h-4 w-4" />}
          options={REVIEW_STATE_OPTIONS}
          value={params.extra.reviewState || undefined}
          onChange={(value) =>
            setParams({
              extra: {
                reviewState: value,
                // Exact state takes precedence over the tab; switch to All for clarity
                ...(value ? { state: 'all' } : {}),
              },
            })
          }
          searchPlaceholder="States"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={reports.data?.data ?? []}
        meta={reports.data?.meta}
        isPending={reports.isPending || reports.isFetching}
        error={reports.isError ? 'Failed to load final reports' : null}
        onPageChange={(page) => setParams({ page })}
        pageSize={params.pageSize}
        onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
        onRowClick={(report) => router.push(openHref(report))}
        emptyMessage={
          state === 'needsAction'
            ? 'No final reports need firm action'
            : state === 'awaitingClient'
              ? 'No final reports are awaiting the client'
              : 'No final reports in a client review cycle'
        }
      />
    </div>
  );
}

export default function FirmFinalReportsPage() {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <FirmFinalReportsInner />
    </Suspense>
  );
}
