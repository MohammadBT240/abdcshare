'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconAlertTriangle, IconDownload, IconLoader2, IconRefresh, IconShieldX } from '@tabler/icons-react';
import { LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { fetchLibraryPreview } from '@/features/library/hooks/use-library';
import type { LibraryItem, LibraryPreview } from '@/features/library/types';
import { LibraryPdfViewer } from '@/features/library/components/library-pdf-viewer';
import { VIEW_ONLY_LIMIT } from '@/features/library/lib/licence';

/** Specific messages for classified conversion failures (S3, D28). */
const FAILURE_TEXT: Record<string, { title: string; hint: string }> = {
  password_protected: {
    title: 'This file is password-protected',
    hint: "It can't be shown in the browser. Ask the uploader for a copy without a password.",
  },
  corrupt: { title: "This file couldn't be read", hint: 'It may be damaged or saved in an unusual format.' },
  timeout: { title: 'This file took too long to convert', hint: 'Very large or complex files sometimes do.' },
  unknown: { title: "This file couldn't be converted for preview", hint: '' },
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      {children}
    </div>
  );
}

/**
 * Inline document viewer for `/library/[id]`. PDFs (native or converted from Office) render with
 * PDF.js (S2); images and text render directly. Office conversions are polled until ready.
 * View-only items (D22) never offer a download button here.
 */
export function LibraryViewer({
  item,
  onDownload,
  downloading,
}: {
  item: LibraryItem;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const preview = useQuery({
    // Keyed on the file (not updatedAt) so a metadata edit doesn't re-open the file and count a view.
    queryKey: ['library', 'preview', item.id, item.fileName, item.sizeBytes, item.declaredAt],
    queryFn: () => fetchLibraryPreview(item.id),
    // Each successful fetch counts a view and mints a fresh short-lived URL — don't refetch casually.
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => ((q.state.data as LibraryPreview | undefined)?.reason === 'pending' ? 3000 : false),
  });

  const data = preview.data;
  const isText = item.fileType === 'text';
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    if (!isText || !data?.url || data.mode !== 'native') return;
    let cancelled = false;
    fetch(data.url)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setText(t.slice(0, 300_000));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isText, data?.url, data?.mode]);

  async function retry() {
    setRetrying(true);
    try {
      await fetchLibraryPreview(item.id, { retry: true });
      await preview.refetch();
    } finally {
      setRetrying(false);
    }
  }

  const downloadButton = item.canDownload ? (
    <LoadingButton type="button" variant="outline" loading={downloading} onClick={onDownload}>
      <IconDownload className="mr-1.5 h-4 w-4" aria-hidden /> Download
    </LoadingButton>
  ) : (
    <p className="max-w-sm text-xs text-muted-foreground">This item is view-only. {VIEW_ONLY_LIMIT}</p>
  );

  if (preview.isPending) {
    return (
      <Centered>
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading preview…</p>
      </Centered>
    );
  }

  if (preview.isError || !data) {
    return (
      <Centered>
        <IconAlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
        <p className="text-sm text-muted-foreground">The preview could not be loaded.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void preview.refetch()}>
            <IconRefresh className="mr-1.5 h-4 w-4" aria-hidden /> Try again
          </Button>
          {downloadButton}
        </div>
      </Centered>
    );
  }

  if (data.reason === 'pending') {
    return (
      <Centered>
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">Preparing preview…</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Office files are converted to PDF for reading in the browser. This usually takes a few seconds and updates
          on its own.
        </p>
      </Centered>
    );
  }

  if (data.reason === 'quarantined') {
    return (
      <Centered>
        <IconShieldX className="h-8 w-8 text-destructive" aria-hidden />
        <p className="text-sm font-medium text-foreground">Quarantined — the virus scan found a threat</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The file has been moved out of the library and can&apos;t be opened. Delete the item, or ask the uploader for a
          clean copy.
        </p>
      </Centered>
    );
  }

  if (data.reason === 'failed') {
    const why = FAILURE_TEXT[data.errorCode ?? 'unknown'] ?? FAILURE_TEXT.unknown!;
    return (
      <Centered>
        <IconAlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
        <p className="text-sm font-medium text-foreground" data-testid="preview-failure">
          {why.title}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {why.hint}{' '}
          {item.canDownload ? 'Download it to open it in its own application.' : 'Ask the uploader for a PDF version.'}
        </p>
        <div className="flex gap-2">
          {item.canEdit ? (
            <LoadingButton type="button" variant="outline" loading={retrying} onClick={() => void retry()}>
              <IconRefresh className="mr-1.5 h-4 w-4" aria-hidden /> Retry conversion
            </LoadingButton>
          ) : null}
          {downloadButton}
        </div>
      </Centered>
    );
  }

  if (!data.url) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">This file type can't be shown in the browser.</p>
        {downloadButton}
      </Centered>
    );
  }

  if (item.fileType === 'image') {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center bg-muted/30 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.url}
          alt={item.title}
          draggable={item.downloadable}
          onContextMenu={item.downloadable ? undefined : (e) => e.preventDefault()}
          className="max-h-[78vh] max-w-full object-contain"
        />
      </div>
    );
  }

  if (isText && data.mode === 'native') {
    return text == null ? (
      <Centered>
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </Centered>
    ) : (
      <pre className="h-full max-h-[78vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-foreground">
        {text}
      </pre>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {item.fileType === 'excel' ? (
        <p className="border-b border-border bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Spreadsheets are shown as a PDF snapshot — wide sheets may be split across pages.
          {item.canDownload ? ' Download for the full workbook.' : ''}
        </p>
      ) : null}
      <LibraryPdfViewer key={data.url} url={data.url} title={item.title} />
    </div>
  );
}
