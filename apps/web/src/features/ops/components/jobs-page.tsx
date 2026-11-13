'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IconAlertTriangle, IconCircleCheck, IconRefresh, IconShieldCheck } from '@tabler/icons-react';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BffClientError, bffApi } from '@/lib/bff/client';
import { HelpTip } from '@/features/help/components/help-tip';

interface JobsOverview {
  queue: { name: string; connected: boolean; counts: Record<string, number> | null };
  failedJobs: { id: string; name: string; failedReason: string | null; attemptsMade: number; finishedOn: string | null }[];
  outbox: {
    pending: number;
    queued: number;
    failed: number;
    oldestPendingAgeSeconds: number | null;
    stuckQueued: number;
    failedRows: { id: string; status: string; eventType: string; lastError: string | null; createdAt: string; updatedAt: string }[];
  };
  clamd: { reachable: boolean; version: string | null; signaturesAt: string | null; error?: string } | null;
  thresholds: { outboxStaleSeconds: number; queuedStuckSeconds: number; signaturesStaleHours: number };
}

function ago(iso: string | null) {
  return iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : '—';
}

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${warn ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Background jobs (S4): queue counts, failed jobs, failed outbox rows with re-drive, clamd status. */
export function JobsPage() {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['admin', 'jobs'],
    queryFn: () => bffApi<JobsOverview>('/api/admin/jobs'),
    refetchInterval: 15_000,
  });
  const redrive = useMutation({
    mutationFn: (id: string) => bffApi<{ id: string; status: string }>(`/api/admin/jobs/outbox/${id}/redrive`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'jobs'] }),
  });

  const d = data.data;
  const stale = d?.outbox.oldestPendingAgeSeconds != null && d.outbox.oldestPendingAgeSeconds > d.thresholds.outboxStaleSeconds;
  const sigAgeH = d?.clamd?.signaturesAt ? (Date.now() - new Date(d.clamd.signaturesAt).getTime()) / 3_600_000 : null;

  return (
    <div>
      <PageToolbar
        title="Background jobs"
        description="Emails, previews, exports and virus scans run in the worker. Re-drives are recorded in the activity log."
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Admin', href: '/admin/users' },
          { label: 'Background jobs', href: '/admin/jobs' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HelpTip slug="background-jobs" />
            <Button type="button" variant="outline" onClick={() => void data.refetch()} disabled={data.isFetching}>
            <IconRefresh className="mr-1.5 h-4 w-4" aria-hidden /> Refresh
          </Button>
          </div>
        }
      />
      {data.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : data.isError || !d ? (
        <p className="text-sm text-destructive">Could not load the job status.</p>
      ) : (
        <div className="space-y-4">
          <Card className="border-border p-4 shadow-aca sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Outbox</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="outbox-stats">
              <Stat label="Pending" value={d.outbox.pending} />
              <Stat
                label={d.outbox.stuckQueued ? `Queued (${d.outbox.stuckQueued} stuck)` : 'Queued'}
                value={d.outbox.queued}
                warn={d.outbox.stuckQueued > 0}
              />
              <Stat label="Failed" value={d.outbox.failed} warn={d.outbox.failed > 0} />
              <Stat
                label="Oldest pending"
                value={d.outbox.oldestPendingAgeSeconds == null ? '—' : `${Math.round(d.outbox.oldestPendingAgeSeconds / 60)} min`}
                warn={stale}
              />
            </div>
          </Card>

          <Card className="border-border p-4 shadow-aca sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Queue <span className="font-mono text-xs text-muted-foreground">{d.queue.name}</span>
            </h2>
            {d.queue.counts ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {Object.entries(d.queue.counts).map(([k, v]) => (
                  <Stat key={k} label={k} value={v} warn={k === 'failed' && v > 0} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-700">Redis is not configured — jobs aren't being queued.</p>
            )}
          </Card>

          <Card className="border-border p-4 shadow-aca sm:p-5">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Failed or stuck outbox rows</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Failed: the last attempt errored — fix the cause, then re-drive it. Stuck: queued for over{' '}
              {Math.round(d.thresholds.queuedStuckSeconds / 60)} minutes without finishing (usually a worker restart) — re-drive it.
            </p>
            {d.outbox.failedRows.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCircleCheck className="h-4 w-4 text-primary" aria-hidden /> None
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border" data-testid="failed-outbox">
                {d.outbox.failedRows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-foreground">
                        {r.eventType} <span className="font-sans text-muted-foreground">· {r.status === 'Queued' ? 'stuck' : 'failed'}</span>
                      </p>
                      <p className="break-words text-xs text-destructive">
                        {r.status === 'Queued' ? 'Never finished' : (r.lastError ?? 'Unknown error')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Created {ago(r.createdAt)} · last tried {ago(r.updatedAt)}
                      </p>
                    </div>
                    <LoadingButton
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={redrive.isPending && redrive.variables === r.id}
                      onClick={async () => {
                        try {
                          await redrive.mutateAsync(r.id);
                          toast.success('Re-queued — it will run within a few seconds');
                        } catch (err) {
                          toast.error(err instanceof BffClientError ? err.message : 'Re-drive failed');
                        }
                      }}
                    >
                      Re-drive
                    </LoadingButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-border p-4 shadow-aca sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Failed queue jobs (latest 50)</h2>
            {d.failedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {d.failedJobs.map((j) => (
                  <li key={j.id} className="px-3 py-2 text-xs">
                    <span className="font-mono text-foreground">{j.name}</span> · {j.attemptsMade} attempt(s) · {ago(j.finishedOn)}
                    <p className="break-words text-destructive">{j.failedReason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-border p-4 shadow-aca sm:p-5" data-testid="clamd-status">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconShieldCheck className="h-4 w-4" aria-hidden /> Virus scanner (clamd)
            </h2>
            {!d.clamd ? (
              <p className="text-sm text-muted-foreground">Not configured for the API (CLAMD_HOST unset).</p>
            ) : d.clamd.reachable ? (
              <p className="text-sm text-foreground">
                {d.clamd.version}
                {sigAgeH != null ? (
                  <span className={sigAgeH > d.thresholds.signaturesStaleHours ? ' text-amber-700' : ' text-muted-foreground'}>
                    {' '}
                    · signatures {Math.round(sigAgeH)} h old
                  </span>
                ) : (
                  <span className="text-amber-700"> · signature date unknown</span>
                )}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <IconAlertTriangle className="h-4 w-4" aria-hidden /> Unreachable: {d.clamd.error}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
