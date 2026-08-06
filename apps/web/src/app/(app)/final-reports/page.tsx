'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { IconArrowRight } from '@tabler/icons-react';
import { DataTable } from '@/components/data/data-table';
import { StatusPill } from '@/components/data';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Button } from '@/components/ui/button';
import {
  type ClientPendingReport,
  useClientFinalReports,
} from '@/features/report-reviews/hooks/use-report-reviews';

function formatSentAt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function FinalReportsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const reports = useClientFinalReports(`page=${page}&pageSize=20`);
  const columns = useMemo<ColumnDef<ClientPendingReport, unknown>[]>(
    () => [
      {
        header: 'Report',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-start gap-2">
            <FileTypeIcon
              fileName={row.original.fileName ?? undefined}
              mimeType={row.original.mimeType}
              size={18}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.title}</p>
              {row.original.fileName ? (
                <p className="truncate text-xs text-muted-foreground">{row.original.fileName}</p>
              ) : null}
            </div>
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
        header: 'Status',
        cell: () => <StatusPill tone="warning">Awaiting your response</StatusPill>,
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
              router.push(`/final-reports/${row.original.documentId}`);
            }}
          >
            Review
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
        title="Final reports"
        description="Draft reports awaiting your approval or feedback"
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Final reports' }]}
      />
      <DataTable
        columns={columns}
        data={reports.data?.data ?? []}
        meta={reports.data?.meta}
        isPending={reports.isPending || reports.isFetching}
        error={reports.isError ? 'Failed to load final reports' : null}
        onPageChange={setPage}
        onRowClick={(report) => router.push(`/final-reports/${report.documentId}`)}
        emptyMessage="No final reports are awaiting your response"
      />
    </div>
  );
}
