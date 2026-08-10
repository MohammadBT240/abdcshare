import { toast } from 'sonner';
import { bffJson } from '@/lib/bff/client';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  entityId?: string | null;
  link?: string | null;
  createdAt: string;
};

type NotificationList = {
  data: NotificationRow[];
};

const activeWatchers = new Map<string, AbortController>();

/** Resolve a BFF export download path (JSON `{ url }`) or open an absolute URL. */
export async function openExportDownloadLink(link: string): Promise<void> {
  const url = await resolveExportDownloadUrl(link);
  triggerBrowserDownload(url);
}

async function resolveExportDownloadUrl(link: string): Promise<string> {
  if (/^https?:\/\//i.test(link) && !link.includes('/api/bff/')) {
    return link;
  }
  const path = link.startsWith('/') ? link : `/${link}`;
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || 'Failed to get download URL');
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error('Download URL missing');
  return data.url;
}

/** Prefer `<a download>` to reduce popup-blocker issues from async poll callbacks. */
function triggerBrowserDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  a.download = '';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function newestOf(rows: NotificationRow[]): NotificationRow | undefined {
  return rows.reduce<NotificationRow | undefined>((best, n) => {
    if (!best) return n;
    return new Date(n.createdAt).getTime() >= new Date(best.createdAt).getTime() ? n : best;
  }, undefined);
}

async function showReadyToast(toastId: string | number, ready: NotificationRow): Promise<void> {
  if (ready.link) {
    try {
      await openExportDownloadLink(ready.link);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed', {
        id: toastId,
        description: 'Use Download below or the notification bell.',
        duration: 12_000,
        action: {
          label: 'Download',
          onClick: () => {
            void openExportDownloadLink(ready.link!).catch((retryErr) => {
              toast.error(retryErr instanceof Error ? retryErr.message : 'Download failed');
            });
          },
        },
      });
      return;
    }
  }

  toast.success('Archive ready', {
    id: toastId,
    description: ready.body || 'Your zip download has started.',
    duration: 60_000,
    action: {
      label: 'Download',
      onClick: () => {
        void openExportDownloadLink(ready.link!).catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Download failed');
        });
      },
    },
  });
}

/**
 * Sticky Sonner toast that polls notifications until the export finishes.
 * Keeps polling for large archives (does not give up after a few minutes).
 */
export async function watchSubmissionExportToast(opts: {
  submissionId: string;
  toastId?: string | number;
  /** Hard stop after this many ms (default 45 minutes). */
  timeoutMs?: number;
}): Promise<void> {
  const submissionId = opts.submissionId;
  const toastId = opts.toastId ?? `submission-export-${submissionId}`;
  const timeoutMs = opts.timeoutMs ?? 45 * 60_000;
  const startedAt = Date.now();

  // Cancel any previous watcher for the same submission (avoids stacked polls).
  activeWatchers.get(submissionId)?.abort();
  const ac = new AbortController();
  activeWatchers.set(submissionId, ac);

  toast.loading('Preparing archive…', {
    id: toastId,
    description: 'Building a zip of this response. Large files can take several minutes.',
    duration: Infinity,
  });

  let warnedSlow = false;

  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (ac.signal.aborted) return;

      const elapsed = Date.now() - startedAt;
      // Back off polling for big jobs so we don't spam the API.
      const interval = elapsed < 60_000 ? 2_500 : elapsed < 5 * 60_000 ? 5_000 : 10_000;
      await sleep(interval, ac.signal);

      if (!warnedSlow && elapsed >= 90_000) {
        warnedSlow = true;
        toast.loading('Still preparing…', {
          id: toastId,
          description: 'Large responses take longer. We’ll update this when the zip is ready.',
          duration: Infinity,
        });
      }

      try {
        const list = await bffJson<NotificationList>(
          '/api/bff/notifications?page=1&pageSize=30',
        );
        if (ac.signal.aborted) return;

        // Only notifications created after this export started (60s clock skew allowance).
        const since = startedAt - 60_000;
        const forThisRun = list.data.filter(
          (n) =>
            n.entityId === submissionId &&
            new Date(n.createdAt).getTime() >= since,
        );

        const newestReady = newestOf(
          forThisRun.filter((n) => n.type === 'submission.export_ready' && n.link),
        );
        const newestFailed = newestOf(
          forThisRun.filter((n) => n.type === 'submission.export_failed'),
        );

        if (
          newestFailed &&
          (!newestReady ||
            new Date(newestFailed.createdAt).getTime() >=
              new Date(newestReady.createdAt).getTime())
        ) {
          toast.error('Response download failed', {
            id: toastId,
            description: newestFailed.body || 'Try Download all again.',
            duration: 12_000,
          });
          return;
        }

        if (newestReady?.link) {
          await showReadyToast(toastId, newestReady);
          return;
        }
      } catch {
        // Keep waiting — transient network blips shouldn't kill the toast.
      }
    }

    toast.info('Export still running', {
      id: toastId,
      description:
        'This is taking a long time. Check the notification bell — we’ll leave a download there when it’s ready.',
      duration: 20_000,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    toast.error('Could not track export progress', {
      id: toastId,
      description: 'Check the notification bell for the download when it’s ready.',
      duration: 12_000,
    });
  } finally {
    if (activeWatchers.get(submissionId) === ac) {
      activeWatchers.delete(submissionId);
    }
  }
}
