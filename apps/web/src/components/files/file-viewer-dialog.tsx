"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconArrowLeft,
  IconDownload,
  IconFolder,
  IconLoader2,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/forms";
import { FileTypeIcon } from "@/components/data/file-type-icon";
import { cn } from "@/lib/utils";

export type FilePreviewResult = {
  url: string | null;
  mode: "native" | "converted" | "unavailable";
  previewStatus: string;
  reason?: "pending" | "failed" | "unsupported";
};

export type ZipEntriesResult = {
  entries: Array<{ name: string; size: number; isDirectory: boolean }>;
};

export type ZipEntryOpenResult = {
  url: string;
  fileName: string;
  mimeType: string;
};

const BLOCKED_EXT =
  /\.(exe|dmg|pkg|msi|bat|cmd|com|scr|ps1|sh|bash|zsh|html?|htm|xhtml|svg|js|mjs|cjs|wasm|apk|app|deb|rpm|dll|so|dylib)$/i;

const OFFICE_EXT = /\.(docx?|pptx?|xlsx?|odt|ods|odp|rtf)$/i;

const DOCUMENT_EXT =
  /\.(pdf|docx?|pptx?|xlsx?|odt|ods|odp|rtf|txt|csv|md|json|xml)$/i;

function isZip(mimeType?: string | null, fileName?: string): boolean {
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  )
    return true;
  return Boolean(fileName?.toLowerCase().endsWith(".zip"));
}

function isBlocked(mime?: string | null, fileName?: string) {
  if (
    mime === "text/html" ||
    mime === "image/svg+xml" ||
    mime === "application/javascript" ||
    mime === "text/javascript"
  ) {
    return true;
  }
  return Boolean(fileName && BLOCKED_EXT.test(fileName));
}

function isOffice(mime?: string | null, fileName?: string) {
  if (
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return true;
  }
  return Boolean(fileName && OFFICE_EXT.test(fileName));
}

/** Allowlisted for in-app preview (includes all common document types). */
function isAllowlisted(mime?: string | null, fileName?: string) {
  if (isBlocked(mime, fileName)) return false;
  if (isZip(mime, fileName)) return true;
  if (isOffice(mime, fileName)) return true;
  if (mime === "application/pdf") return true;
  if (mime?.startsWith("image/") && mime !== "image/svg+xml") return true;
  if (mime?.startsWith("text/") && mime !== "text/html") return true;
  if (mime?.startsWith("video/")) return true;
  if (mime === "application/json" || mime === "application/xml") return true;
  if (fileName && DOCUMENT_EXT.test(fileName)) return true;
  return false;
}

/**
 * Zip members we will extract and open in the viewer.
 * Everything else (dmg/exe/office-in-zip/etc.) is download-only — no open/process.
 */
function canPreviewZipEntry(fileName: string, mime?: string | null): boolean {
  if (isBlocked(mime, fileName)) return false;
  if (isOffice(mime, fileName)) return false;
  if (!isAllowlisted(mime, fileName) && !isAllowlisted(undefined, fileName))
    return false;
  if (/\.pdf$/i.test(fileName) || mime === "application/pdf") return true;
  if (/\.(png|jpe?g|gif|webp)$/i.test(fileName) || isImage(mime)) return true;
  if (/\.(txt|csv|md|json|xml)$/i.test(fileName) || isText(mime)) return true;
  if (/\.(mp4|mov|webm)$/i.test(fileName) || isVideo(mime)) return true;
  return false;
}

function isImage(mime?: string | null) {
  return Boolean(mime?.startsWith("image/") && mime !== "image/svg+xml");
}

function isVideo(mime?: string | null) {
  return Boolean(mime?.startsWith("video/"));
}

function isPdf(mime?: string | null, mode?: string) {
  return mime === "application/pdf" || mode === "converted";
}

function isText(mime?: string | null) {
  return Boolean(
    (mime?.startsWith("text/") && mime !== "text/html") ||
    mime === "application/json",
  );
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function CenteredStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      {children}
    </div>
  );
}

interface FileViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  getPreview: (opts?: { retryFailed?: boolean }) => Promise<FilePreviewResult>;
  getZipEntries?: () => Promise<ZipEntriesResult>;
  /** Open a single zip member for preview/download. */
  getZipEntry?: (entryPath: string) => Promise<ZipEntryOpenResult>;
  onDownload: () => Promise<void> | void;
}

export function FileViewerDialog({
  open,
  onOpenChange,
  fileName,
  mimeType,
  getPreview,
  getZipEntries,
  getZipEntry,
  onDownload,
}: FileViewerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<FilePreviewResult | null>(null);
  const [zipEntries, setZipEntries] = useState<
    ZipEntriesResult["entries"] | null
  >(null);
  const [textBody, setTextBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [entryLoading, setEntryLoading] = useState<string | null>(null);
  const [entryDownloading, setEntryDownloading] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<ZipEntryOpenResult | null>(
    null,
  );
  const [entryText, setEntryText] = useState<string | null>(null);

  const getPreviewRef = useRef(getPreview);
  const getZipEntriesRef = useRef(getZipEntries);
  const getZipEntryRef = useRef(getZipEntry);
  getPreviewRef.current = getPreview;
  getZipEntriesRef.current = getZipEntries;
  getZipEntryRef.current = getZipEntry;

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setZipEntries(null);
      setTextBody(null);
      setError(null);
      setActiveEntry(null);
      setEntryText(null);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadPreview(isPoll: boolean) {
      if (!isPoll) {
        setLoading(true);
        setError(null);
        setActiveEntry(null);
        setEntryText(null);
      }
      try {
        if (!isPoll && isZip(mimeType, fileName) && getZipEntriesRef.current) {
          const z = await getZipEntriesRef.current();
          if (!cancelled) setZipEntries(z.entries);
        }
        // First open may re-enqueue a previously failed Office conversion; polls must not.
        const result = await getPreviewRef.current(
          isPoll ? undefined : { retryFailed: true },
        );
        if (cancelled) return;
        setPreview(result);
        if (result.url && isText(mimeType) && result.mode === "native") {
          try {
            const res = await fetch(result.url);
            const text = await res.text();
            if (!cancelled) setTextBody(text.slice(0, 200_000));
          } catch {
            // fall through
          }
        }
        // Office conversion is async — poll until Ready/Failed.
        if (result.reason === "pending") {
          pollTimer = setTimeout(() => {
            void loadPreview(true);
          }, 2500);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load preview",
          );
        }
      } finally {
        if (!cancelled && !isPoll) setLoading(false);
      }
    }

    void loadPreview(false);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [open, fileName, mimeType]);

  async function handleDownload() {
    setDownloading(true);
    try {
      if (activeEntry) {
        window.open(activeEntry.url, "_blank", "noopener,noreferrer");
      } else {
        await onDownload();
      }
    } finally {
      setDownloading(false);
    }
  }

  async function openZipEntry(entryPath: string) {
    if (!getZipEntryRef.current) return;
    const name = baseName(entryPath);
    if (!canPreviewZipEntry(name)) return;

    setEntryLoading(entryPath);
    setError(null);
    try {
      const result = await getZipEntryRef.current(entryPath);
      setActiveEntry(result);
      setEntryText(null);
      if (
        isText(result.mimeType) &&
        canPreviewZipEntry(result.fileName, result.mimeType)
      ) {
        try {
          const res = await fetch(result.url);
          setEntryText((await res.text()).slice(0, 200_000));
        } catch {
          // show download fallback
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open zip entry");
    } finally {
      setEntryLoading(null);
    }
  }

  /**
   * Download a zip member without opening/previewing it.
   * Blocked types (dmg/exe/…) are never extracted — download the archive instead.
   */
  async function downloadZipEntry(entryPath: string) {
    const name = baseName(entryPath);
    setEntryDownloading(entryPath);
    setError(null);
    try {
      if (isBlocked(undefined, name) || !isAllowlisted(undefined, name)) {
        await onDownload();
        return;
      }
      if (!getZipEntryRef.current) return;
      const result = await getZipEntryRef.current(entryPath);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download zip entry",
      );
    } finally {
      setEntryDownloading(null);
    }
  }

  const url = activeEntry?.url ?? preview?.url ?? null;
  const viewMime = activeEntry?.mimeType ?? mimeType;
  const viewName = activeEntry?.fileName ?? fileName;
  const filesOnly = (zipEntries ?? []).filter((e) => !e.isDirectory);
  const allowlisted = isAllowlisted(viewMime, viewName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle className="truncate pr-8">{viewName}</DialogTitle>
          <DialogDescription className="truncate">
            {activeEntry
              ? `${activeEntry.mimeType} · from ${fileName}`
              : mimeType || "Unknown type"}
            {preview?.mode === "converted" && !activeEntry
              ? " · converted preview"
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-[40vh] flex-1 overflow-auto bg-muted/20">
          {loading ? (
            <CenteredStatus>
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading preview…</p>
            </CenteredStatus>
          ) : entryLoading ? (
            <CenteredStatus>
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Opening file…</p>
            </CenteredStatus>
          ) : error && !zipEntries ? (
            <CenteredStatus>
              <p className="text-sm text-destructive">{error}</p>
            </CenteredStatus>
          ) : activeEntry ? (
            <div className="space-y-3 px-4 py-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setActiveEntry(null);
                  setEntryText(null);
                  setError(null);
                }}
              >
                <IconArrowLeft className="mr-1.5 h-4 w-4" />
                Back to archive
              </Button>
              {isImage(viewMime) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeEntry.url}
                  alt={activeEntry.fileName}
                  className="mx-auto max-h-[60vh] object-contain"
                />
              ) : isVideo(viewMime) ? (
                <video
                  src={activeEntry.url}
                  controls
                  className="mx-auto max-h-[60vh] w-full"
                />
              ) : entryText != null ? (
                <pre className="max-h-[60vh] overflow-auto rounded-md border border-border bg-card p-3 text-xs">
                  {entryText}
                </pre>
              ) : isPdf(viewMime) ? (
                <iframe
                  src={activeEntry.url}
                  title={`Preview ${activeEntry.fileName}`}
                  className="h-[60vh] w-full rounded-md border border-border bg-white"
                />
              ) : (
                <CenteredStatus>
                  <p className="text-sm text-muted-foreground">
                    Preview is not available for this file type inside the
                    archive.
                  </p>
                  <LoadingButton
                    type="button"
                    loading={downloading}
                    onClick={() => void handleDownload()}
                  >
                    <IconDownload className="mr-1.5 h-4 w-4" />
                    Download file
                  </LoadingButton>
                </CenteredStatus>
              )}
            </div>
          ) : zipEntries ? (
            <div className="space-y-3 px-4 py-4">
              <p className="text-sm text-muted-foreground">
                {filesOnly.length} file{filesOnly.length === 1 ? "" : "s"} in
                archive. Open supported files, or download others.
              </p>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <ul className="max-h-[55vh] overflow-auto rounded-md border border-border bg-card">
                {zipEntries.map((e) => {
                  const name = baseName(e.name);
                  const previewable = canPreviewZipEntry(name);
                  const opening = entryLoading === e.name;
                  const downloadingEntry = entryDownloading === e.name;
                  if (e.isDirectory) {
                    return (
                      <li
                        key={e.name}
                        className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground last:border-0"
                      >
                        <IconFolder className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate font-mono">
                          {e.name}
                        </span>
                      </li>
                    );
                  }
                  if (!previewable) {
                    const extractForDownload =
                      isAllowlisted(undefined, name) &&
                      !isBlocked(undefined, name);
                    return (
                      <li
                        key={e.name}
                        className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-0"
                      >
                        <FileTypeIcon fileName={name} size={18} />
                        <span
                          className="min-w-0 flex-1 truncate font-medium"
                          title={e.name}
                        >
                          {name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatBytes(e.size)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          disabled={
                            downloadingEntry ||
                            (extractForDownload && !getZipEntry)
                          }
                          title={
                            extractForDownload
                              ? `Download ${name}`
                              : `Download archive (cannot open ${name} in browser)`
                          }
                          aria-label={`Download ${name}`}
                          onClick={() => void downloadZipEntry(e.name)}
                        >
                          {downloadingEntry ? (
                            <IconLoader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <IconDownload className="h-4 w-4" />
                          )}
                        </Button>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={e.name}
                      className="border-b border-border last:border-0"
                    >
                      <button
                        type="button"
                        disabled={!getZipEntry || opening}
                        onClick={() => void openZipEntry(e.name)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                          getZipEntry
                            ? "hover:bg-muted/50"
                            : "cursor-default opacity-80",
                        )}
                      >
                        <FileTypeIcon fileName={name} size={18} />
                        <span
                          className="min-w-0 flex-1 truncate font-medium"
                          title={e.name}
                        >
                          {name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {opening ? (
                            <IconLoader2 className="inline h-3.5 w-3.5 animate-spin" />
                          ) : (
                            formatBytes(e.size)
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : preview?.reason === "pending" ? (
            <CenteredStatus>
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                Generating preview… Office files convert to PDF in the
                background. This updates automatically, or download the
                original.
              </p>
            </CenteredStatus>
          ) : preview?.reason === "failed" ? (
            <CenteredStatus>
              <p className="text-sm text-muted-foreground">
                Preview generation failed. Download the original file instead.
                {isOffice(mimeType, fileName)
                  ? " Ensure the worker has STORAGE_DRIVER=r2 and LibreOffice installed."
                  : null}
              </p>
            </CenteredStatus>
          ) : !allowlisted ? (
            <CenteredStatus>
              <p className="text-sm text-muted-foreground">
                This file type cannot be previewed in the browser for security
                reasons. Download to open it.
              </p>
            </CenteredStatus>
          ) : url && isImage(viewMime) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={viewName}
              className="mx-auto max-h-[65vh] object-contain px-4 py-4"
            />
          ) : url && isVideo(viewMime) ? (
            <video
              src={url}
              controls
              className="mx-auto max-h-[65vh] w-full px-4 py-4"
            />
          ) : url && textBody != null ? (
            <pre className="m-4 max-h-[65vh] overflow-auto rounded-md border border-border bg-card p-3 text-xs">
              {textBody}
            </pre>
          ) : url &&
            (isPdf(viewMime, preview?.mode) || preview?.mode === "native") ? (
            <iframe
              src={url}
              title={`Preview ${viewName}`}
              className="m-4 h-[65vh] w-[calc(100%-2rem)] rounded-md border border-border bg-white"
            />
          ) : (
            <CenteredStatus>
              <p className="text-sm text-muted-foreground">
                In-app preview is not available for this file type. Download to
                view it.
              </p>
            </CenteredStatus>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <LoadingButton
            type="button"
            loading={downloading}
            onClick={() => void handleDownload()}
          >
            <IconDownload className="mr-1.5 h-4 w-4" />
            {activeEntry ? "Download file" : "Download"}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
