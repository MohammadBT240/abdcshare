'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict, format } from 'date-fns';
import {
  IconArchive,
  IconDownload,
  IconEye,
  IconFileUpload,
  IconFlag,
  IconFlagCheck,
  IconFolderMinus,
  IconFolderPlus,
  IconLoader2,
  IconLock,
  IconPencil,
  IconReplace,
  IconRestore,
  IconTrash,
  IconUserShare,
  IconZip,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLibraryItemEventSummary, useLibraryItemEvents } from '@/features/library/hooks/use-library';
import { OUTCOME_LABEL, reportReasonLabel } from '@/features/library/lib/licence';
import type { LibraryEvent, LibraryEventAction, LibraryReportOutcome, LibraryReportReason } from '@/features/library/types';

const FIELD_LABEL: Record<string, string> = {
  title: 'title',
  categoryId: 'category',
  description: 'description',
  authors: 'authors',
  publishedYear: 'year',
  source: 'source',
  tags: 'tags',
  licence: 'licence',
  licenceNote: 'licence note',
  downloadable: 'view-only setting',
};

const ICON: Record<LibraryEventAction, typeof IconEye> = {
  Viewed: IconEye,
  Downloaded: IconDownload,
  Uploaded: IconFileUpload,
  FileReplaced: IconReplace,
  Edited: IconPencil,
  VisibilityChanged: IconLock,
  Archived: IconArchive,
  Restored: IconRestore,
  Deleted: IconTrash,
  Reported: IconFlag,
  ReportResolved: IconFlagCheck,
  OwnershipTransferred: IconUserShare,
  AddedToCollection: IconFolderPlus,
  RemovedFromCollection: IconFolderMinus,
  ZipExported: IconZip,
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

/** One line of plain English per event. */
export function describeEvent(e: LibraryEvent): React.ReactNode {
  const m = e.metadata;
  const collection = e.collection ? (
    <Link href={`/library/collections/${e.collection.id}`} className="font-medium hover:underline">
      {e.collection.title}
    </Link>
  ) : (
    <span className="font-medium">{str(m.collectionTitle) ?? 'a collection'}</span>
  );
  switch (e.action) {
    case 'Viewed':
      return 'opened it';
    case 'Downloaded':
      return 'downloaded it';
    case 'Uploaded':
      return <>uploaded {str(m.fileName) ? <span className="font-medium">{str(m.fileName)}</span> : 'the file'}</>;
    case 'FileReplaced':
      return (
        <>
          replaced {str(m.previousFileName) ? <span className="font-medium">{str(m.previousFileName)}</span> : 'the file'}
          {str(m.fileName) ? <> with <span className="font-medium">{str(m.fileName)}</span></> : null}
        </>
      );
    case 'Edited': {
      const fields = Array.isArray(m.fields) ? (m.fields as string[]).map((f) => FIELD_LABEL[f] ?? f) : [];
      return fields.length ? `edited the ${fields.join(', ')}` : 'edited the details';
    }
    case 'VisibilityChanged': {
      const deps = Array.isArray(m.departments) ? (m.departments as string[]) : [];
      return m.to === 'Firm' ? 'made it visible to everyone in the firm' : `restricted it to ${deps.join(', ') || 'departments'}`;
    }
    case 'Archived':
      return m.reason === 'report' ? 'archived it after a report' : 'archived it';
    case 'Restored':
      return 'restored it';
    case 'Deleted':
      return 'deleted it';
    case 'Reported':
      return <>reported it: {reportReasonLabel(m.reason as LibraryReportReason)}</>;
    case 'ReportResolved':
      return <>resolved the report — {OUTCOME_LABEL[m.outcome as LibraryReportOutcome] ?? String(m.outcome)}</>;
    case 'OwnershipTransferred':
      return 'transferred ownership';
    case 'AddedToCollection':
      return <>added it to {collection}</>;
    case 'RemovedFromCollection':
      return <>removed it from {collection}</>;
    case 'ZipExported':
      return <>downloaded {collection} as a ZIP</>;
    default:
      return e.action;
  }
}

/** Activity tab (uploader + curators): totals and a newest-first timeline. Every view counts. */
export function LibraryActivity({ itemId }: { itemId: string }) {
  const summary = useLibraryItemEventSummary(itemId);
  const events = useLibraryItemEvents(itemId);
  const counts = summary.data?.counts ?? {};
  const rows = events.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['Viewed', 'Views'],
            ['Downloaded', 'Downloads'],
            ['Reported', 'Reports'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="rounded-lg border border-border bg-muted/30 px-2 py-2">
            <p className="text-lg font-semibold tabular-nums text-foreground">{summary.isPending ? '–' : (counts[key] ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {events.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : events.isError ? (
        <p className="text-sm text-destructive">The activity could not be loaded.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="divide-y divide-border" aria-label="Activity">
          {rows.map((e) => {
            const Icon = ICON[e.action] ?? IconEye;
            const at = new Date(e.createdAt);
            return (
              <li key={e.id} className="flex items-start gap-3 py-2.5 text-sm" data-action={e.action}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="min-w-0 flex-1 text-foreground">
                  <span className="font-medium">{e.actor?.name ?? 'Someone'}</span> {describeEvent(e)}
                </p>
                <time
                  dateTime={e.createdAt}
                  title={format(at, 'd MMM yyyy, HH:mm')}
                  className="shrink-0 text-xs tabular-nums text-muted-foreground"
                >
                  {formatDistanceToNowStrict(at, { addSuffix: true })}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      {events.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={events.isFetchingNextPage}
          onClick={() => void events.fetchNextPage()}
        >
          {events.isFetchingNextPage ? <IconLoader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          Show older activity
        </Button>
      ) : null}
    </div>
  );
}
