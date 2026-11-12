'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LibraryAttentionPanel, LibraryDuplicatesPanel } from '@/features/library/components/library-attention';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { IconArchive, IconCheck, IconFlag, IconLock, IconTrash, IconWorld } from '@tabler/icons-react';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FormDialog, FormField, LoadingButton, MultiCombobox } from '@/components/forms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import { useDepartments } from '@/features/users/hooks/use-users';
import { useLibraryReports, useResolveLibraryReport } from '@/features/library/hooks/use-library';
import { OUTCOME_LABEL, reportReasonLabel } from '@/features/library/lib/licence';
import type { LibraryReportGroup, LibraryReportOutcome, LibraryReportStatus } from '@/features/library/types';

const OUTCOMES: { value: LibraryReportOutcome; label: string; icon: typeof IconCheck; hint: string }[] = [
  { value: 'Dismiss', label: 'Dismiss', icon: IconCheck, hint: 'Nothing wrong — leave the item as it is.' },
  { value: 'Restrict', label: 'Restrict', icon: IconLock, hint: 'Keep it, but only for the departments you choose.' },
  { value: 'Archive', label: 'Archive', icon: IconArchive, hint: 'Hide it from the library. The uploader can still see it.' },
  { value: 'Delete', label: 'Delete', icon: IconTrash, hint: "Remove it and its file for everyone. Can't be undone." },
];

function ago(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

/** Curator review queue (S2, D20): open reports grouped by item, newest first. */
type Tab = LibraryReportStatus | 'attention' | 'duplicates';
const TABS: Tab[] = ['Open', 'Actioned', 'Dismissed', 'attention', 'duplicates'];

export function LibraryReviewPage() {
  const params = useSearchParams();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'Open');
  const status: LibraryReportStatus = tab === 'attention' || tab === 'duplicates' ? 'Open' : tab;
  const [page, setPage] = useState(1);
  const reports = useLibraryReports(status, page);
  const [resolving, setResolving] = useState<{ group: LibraryReportGroup; outcome: LibraryReportOutcome } | null>(null);
  const groups = reports.data?.data ?? [];
  const meta = reports.data?.meta;

  return (
    <div>
      <PageToolbar
        title="Review queue"
        description="Reported items, and everything else in the library that needs a curator."
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Library', href: '/library' },
          { label: 'Review queue', href: '/library/review' },
        ]}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="Open">Open</TabsTrigger>
          <TabsTrigger value="Actioned">Actioned</TabsTrigger>
          <TabsTrigger value="Dismissed">Dismissed</TabsTrigger>
          <TabsTrigger value="attention">Needs attention</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'attention' ? (
        <LibraryAttentionPanel onOpenReports={() => setTab('Open')} />
      ) : tab === 'duplicates' ? (
        <LibraryDuplicatesPanel />
      ) : reports.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : reports.isError ? (
        <p className="text-sm text-destructive">The review queue could not be loaded.</p>
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 border-border px-6 py-12 text-center shadow-aca">
          <IconFlag className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            {status === 'Open' ? 'Nothing to review' : `No ${status.toLowerCase()} reports`}
          </p>
          {status === 'Open' ? (
            <p className="text-sm text-muted-foreground">When someone reports a library item it appears here.</p>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <ReportGroupCard
              key={g.itemId ?? g.reports[0]?.id}
              group={g}
              open={status === 'Open'}
              onResolve={(outcome) => setResolving({ group: g, outcome })}
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && tab !== 'attention' && tab !== 'duplicates' ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <ResolveDialog value={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}

function ReportGroupCard({
  group,
  open,
  onResolve,
}: {
  group: LibraryReportGroup;
  open: boolean;
  onResolve: (outcome: LibraryReportOutcome) => void;
}) {
  const first = group.reports[0];
  return (
    <Card className="border-border p-4 shadow-aca sm:p-5" data-testid="report-group">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {group.itemId && group.item?.status !== undefined ? (
            <Link href={`/library/${group.itemId}`} className="text-base font-semibold text-foreground hover:underline">
              {group.itemTitle}
            </Link>
          ) : (
            <p className="text-base font-semibold text-foreground">
              {group.itemTitle} <span className="text-xs font-normal text-muted-foreground">(deleted)</span>
            </p>
          )}
          {group.item ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Uploaded by {group.item.uploadedBy.name}</span>
              {group.item.visibility === 'Firm' ? (
                <span className="inline-flex items-center gap-1">
                  <IconWorld className="h-3.5 w-3.5" aria-hidden /> Firm-wide
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <IconLock className="h-3.5 w-3.5" aria-hidden /> {group.item.departments.map((d) => d.name).join(', ')}
                </span>
              )}
              {group.item.status === 'Archived' ? <Badge variant="secondary">Archived</Badge> : null}
            </p>
          ) : null}
        </div>
        {open ? (
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant="outline"
                className={o.value === 'Delete' ? 'border-destructive/40 text-destructive hover:bg-destructive/10' : undefined}
                disabled={!group.item && o.value !== 'Dismiss'}
                onClick={() => onResolve(o.value)}
              >
                <o.icon className="mr-1.5 h-4 w-4" aria-hidden /> {o.label}
              </Button>
            ))}
          </div>
        ) : first?.outcome ? (
          <Badge variant={first.outcome === 'Dismiss' ? 'secondary' : 'warning'}>{OUTCOME_LABEL[first.outcome]}</Badge>
        ) : null}
      </div>

      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {group.reports.map((r) => (
          <li key={r.id} className="space-y-1 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={r.reason === 'ClientConfidential' ? 'destructive' : 'secondary'}>{reportReasonLabel(r.reason)}</Badge>
              <span className="text-muted-foreground">
                {r.reporter.name} · {ago(r.createdAt)}
              </span>
            </div>
            {r.note ? <p className="whitespace-pre-line text-foreground">{r.note}</p> : null}
            {r.resolvedBy ? (
              <p className="text-xs text-muted-foreground">
                {r.outcome ? OUTCOME_LABEL[r.outcome] : 'Resolved'} by {r.resolvedBy.name}
                {r.resolvedAt ? ` · ${ago(r.resolvedAt)}` : ''}
                {r.resolution ? ` — “${r.resolution}”` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ResolveDialog({
  value,
  onClose,
}: {
  value: { group: LibraryReportGroup; outcome: LibraryReportOutcome } | null;
  onClose: () => void;
}) {
  const resolve = useResolveLibraryReport();
  const departments = useDepartments();
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const outcome = value ? OUTCOMES.find((o) => o.value === value.outcome)! : null;
  const count = value?.group.reports.length ?? 0;

  function close() {
    if (resolve.isPending) return;
    setDepartmentIds([]);
    setNote('');
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    if (value.outcome === 'Restrict' && departmentIds.length === 0) return setError('Choose at least one department');
    try {
      const res = await resolve.mutateAsync({
        reportId: value.group.reports[0]!.id,
        outcome: value.outcome,
        departmentIds: value.outcome === 'Restrict' ? departmentIds.map(Number) : undefined,
        note,
      });
      toast.success(`${OUTCOME_LABEL[res.outcome]} — ${res.resolved} report${res.resolved === 1 ? '' : 's'} closed`);
      close();
    } catch (err) {
      setError(err instanceof BffClientError ? err.message : 'Could not resolve the report');
    }
  }

  return (
    <FormDialog
      open={Boolean(value)}
      onOpenChange={(next) => !next && close()}
      title={outcome ? `${outcome.label}: ${value?.group.itemTitle}` : ''}
      description={
        outcome
          ? `${outcome.hint} ${count > 1 ? `All ${count} reports on this item are closed and each reporter is told.` : 'The reporter is told what you decided.'}`
          : undefined
      }
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={resolve.isPending}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="resolve-report-form"
            loading={resolve.isPending}
            className={value?.outcome === 'Delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
          >
            {outcome?.label}
          </LoadingButton>
        </>
      }
    >
      <form id="resolve-report-form" onSubmit={submit} className="space-y-4">
        {value?.outcome === 'Restrict' ? (
          <FormField label="Departments" required>
            <MultiCombobox
              options={(departments.data ?? []).filter((d) => d.isActive).map((d) => ({ value: String(d.id), label: d.name }))}
              values={departmentIds}
              onValuesChange={setDepartmentIds}
              placeholder="Choose departments"
              isLoading={departments.isPending}
              disabled={resolve.isPending}
            />
          </FormField>
        ) : null}
        <FormField label="Note to the reporter" htmlFor="resolve-note" hint="Optional. Shown in their notification.">
          <Textarea
            id="resolve-note"
            rows={3}
            maxLength={2000}
            value={note}
            disabled={resolve.isPending}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </FormDialog>
  );
}
