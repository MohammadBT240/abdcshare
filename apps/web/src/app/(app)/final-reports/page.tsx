'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data/data-table';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import {
  type ClientPendingReport,
  useClientFinalReports,
} from '@/features/report-reviews/hooks/use-report-reviews';

export default function FinalReportsPage() {
  const router = useRouter();
  const { can } = useAuthContext();
  const [page, setPage] = useState(1);
  const reports = useClientFinalReports(`page=${page}&pageSize=20`);
  const columns = useMemo<ColumnDef<ClientPendingReport, unknown>[]>(
    () => [
      { header: 'Report', accessorKey: 'title' },
      {
        header: 'Cycle',
        cell: ({ row }) => `Round ${row.original.reviewRound}`,
      },
      {
        header: 'Version',
        cell: ({ row }) => `v${row.original.currentVersion}`,
      },
      {
        header: 'Status',
        cell: () => <Badge variant="outline">Awaiting your response</Badge>,
      },
    ],
    [],
  );

  if (!can('report-review:respond')) {
    return (
      <div className="space-y-5">
        <PageToolbar title="Final reports" breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Final reports' }]} />
        <p className="text-sm text-destructive">You do not have permission to review final reports.</p>
      </div>
    );
  }

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
