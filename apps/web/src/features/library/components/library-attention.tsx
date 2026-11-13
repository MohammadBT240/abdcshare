'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { IconAlertTriangle, IconCopy, IconFileAlert, IconFlag, IconLockOff, IconShieldX, IconUserOff } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLibraryAttention, useLibraryDuplicateGroups } from '@/features/library/hooks/use-library';
import { TransferOwnerDialog } from '@/features/library/components/transfer-owner-dialog';
import type { LibraryAttentionItem } from '@/features/library/types';

const PREVIEW_ERROR: Record<string, string> = {
  password_protected: 'Password-protected',
  corrupt: "Couldn't be read",
  timeout: 'Conversion timed out',
  unknown: 'Conversion failed',
};

function Section({
  title,
  icon: Icon,
  count,
  hint,
  children,
  testId,
}: {
  title: string;
  icon: typeof IconFlag;
  count: number;
  hint: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Card className="border-border p-4 shadow-aca sm:p-5" data-testid={testId}>
      <div className="flex items-start gap-3">
        <Icon className={count ? 'mt-0.5 h-5 w-5 text-amber-600' : 'mt-0.5 h-5 w-5 text-muted-foreground'} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            {title} <span className="ml-1 tabular-nums text-muted-foreground">{count}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {count ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </Card>
  );
}

function ItemList({ items, detail }: { items: LibraryAttentionItem[]; detail?: (i: LibraryAttentionItem) => React.ReactNode }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((i) => (
        <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
          <Link href={`/library/${i.id}`} className="font-medium text-foreground hover:underline">
            {i.title}
          </Link>
          <span className="text-xs text-muted-foreground">
            {i.uploadedBy.name} · {formatDistanceToNowStrict(new Date(i.updatedAt), { addSuffix: true })}
          </span>
          {detail ? <span className="w-full text-xs text-muted-foreground sm:w-auto">{detail(i)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Curator "Needs attention" (S3, D30). */
export function LibraryAttentionPanel({ onOpenReports }: { onOpenReports: () => void }) {
  const attention = useLibraryAttention();
  const [transfer, setTransfer] = useState<{ fromUserId: string; fromName: string; items: number; collections: number } | null>(
    null,
  );
  if (attention.isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (attention.isError || !attention.data) return <p className="text-sm text-destructive">Could not load this view.</p>;
  const a = attention.data;
  return (
    <div className="space-y-3">
      <Section
        testId="attention-quarantined"
        title="Quarantined"
        icon={IconShieldX}
        count={a.quarantined.length}
        hint="The virus scan found a threat. Hidden from everyone but curators; the file is in quarantine storage."
      >
        <ItemList items={a.quarantined} detail={(i) => i.detail} />
      </Section>
      <Section
        testId="attention-scan-errors"
        title="Virus check failed"
        icon={IconAlertTriangle}
        count={a.scanErrors.length}
        hint="Scanned three times without an answer. Downloads stay closed until a scan succeeds — replace the file to retry."
      >
        <ItemList items={a.scanErrors} detail={(i) => i.detail} />
      </Section>
      <Section
        testId="attention-owners"
        title="Owner has left"
        icon={IconUserOff}
        count={a.ownerDeactivated.length}
        hint="Items and collections whose owner is deactivated. Transfer them so someone can keep them up to date."
      >
        <ul className="divide-y divide-border rounded-lg border border-border">
          {a.ownerDeactivated.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{o.name}</span>
              <span className="text-xs text-muted-foreground">
                {o.items} item{o.items === 1 ? '' : 's'} · {o.collections} collection{o.collections === 1 ? '' : 's'}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => setTransfer({ fromUserId: o.id, fromName: o.name, items: o.items, collections: o.collections })}
              >
                Transfer all…
              </Button>
            </li>
          ))}
        </ul>
      </Section>
      <Section
        testId="attention-orphaned"
        title="Restricted to inactive departments"
        icon={IconLockOff}
        count={a.orphanedRestricted.length}
        hint="Every department these items are restricted to has been deactivated, so only curators and the uploader can see them."
      >
        <ItemList items={a.orphanedRestricted} detail={(i) => i.departments.join(', ')} />
      </Section>
      <Section
        testId="attention-previews"
        title="Previews that failed"
        icon={IconFileAlert}
        count={a.failedPreviews.length}
        hint="Office files that couldn't be converted for reading in the browser."
      >
        <ItemList items={a.failedPreviews} detail={(i) => PREVIEW_ERROR[i.detail ?? 'unknown'] ?? i.detail} />
      </Section>
      <Section
        testId="attention-reports"
        title="Open reports"
        icon={IconFlag}
        count={a.openReports}
        hint="Items staff have reported."
      >
        <Button type="button" size="sm" variant="outline" onClick={onOpenReports}>
          Review reports
        </Button>
      </Section>
      <TransferOwnerDialog
        target={transfer ? { kind: 'all', ...transfer } : null}
        open={Boolean(transfer)}
        onOpenChange={(o) => !o && setTransfer(null)}
      />
    </div>
  );
}

/** Curator duplicates view (D27): the same file held by more than one item, across the whole library. */
export function LibraryDuplicatesPanel() {
  const groups = useLibraryDuplicateGroups();
  if (groups.isPending) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (groups.isError) return <p className="text-sm text-destructive">Could not load duplicates.</p>;
  if (!groups.data?.length) {
    return (
      <Card className="flex flex-col items-center gap-2 border-border px-6 py-12 text-center shadow-aca">
        <IconCopy className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">No duplicate files</p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {groups.data.map((g) => (
        <Card key={g.hash} className="border-border p-4 shadow-aca" data-testid="duplicate-group">
          <p className="mb-2 font-mono text-[11px] text-muted-foreground" title="SHA-256">
            {g.hash.slice(0, 16)}…
          </p>
          <ul className="space-y-1 text-sm">
            {g.items.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-2">
                <Link href={`/library/${i.id}`} className="font-medium text-foreground hover:underline">
                  {i.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {i.status} · {i.uploadedBy} · {formatDistanceToNowStrict(new Date(i.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
