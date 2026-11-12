'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as PdfJsModule from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import {
  IconAlertTriangle,
  IconArrowsHorizontal,
  IconLoader2,
  IconLock,
  IconRefresh,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

type PdfJs = typeof PdfJsModule;

let pdfjsPromise: Promise<PdfJs> | null = null;

/** Load pdf.js once, pointed at the self-hosted worker and data files (copied to /public/pdfjs/<version>/). */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/${pdfjs.version}/pdf.worker.min.mjs`;
    return pdfjs;
  });
  return pdfjsPromise;
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
/** Render pages within this distance of the viewport; release canvases further away. */
const NEAR_MARGIN = '1200px 0px';

type LoadError = 'password' | 'failed';

/**
 * PDF.js viewer for library PDFs and converted Office files (S2, D23). The same component on
 * desktop and phones — it fixes iOS Safari showing only the first page of a PDF in an iframe,
 * and it has no download or print controls, which is what makes view-only (D22) real in the UI.
 * Continuous scroll, zoom (fit width by default), page count, lazy page rendering.
 */
export function LibraryPdfViewer({ url, title }: { url: string; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);

  // Load the document (re-load on a new URL or a retry).
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<PdfJs['getDocument']> | null = null;
    setDoc(null);
    setBase(null);
    setError(null);
    setCurrent(1);
    void loadPdfJs()
      .then(async (pdfjs) => {
        if (cancelled) return;
        const assets = `/pdfjs/${pdfjs.version}`;
        task = pdfjs.getDocument({
          url,
          enableXfa: false,
          cMapUrl: `${assets}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assets}/standard_fonts/`,
          wasmUrl: `${assets}/wasm/`,
          iccUrl: `${assets}/iccs/`,
        });
        const loaded = await task.promise;
        const first = await loaded.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setBase({ w: vp.width, h: vp.height });
        setDoc(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = (err as { name?: string } | null)?.name;
        setError(name === 'PasswordException' ? 'password' : 'failed');
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, attempt]);

  // Fit-to-width: track the scroll container's inner width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!base || width <= 0) return 0;
    // Fit width (16px gutter each side), but don't blow small pages up past 150% before zoom.
    return Math.min((width - 32) / base.w, 1.5) * zoom;
  }, [base, width, zoom]);

  // Current page = the last page whose top is above a third of the viewport.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mark = el.scrollTop + el.clientHeight / 3;
    let page = 1;
    for (const child of el.querySelectorAll<HTMLElement>('[data-pdf-page]')) {
      if (child.offsetTop <= mark) page = Number(child.dataset.pdfPage);
      else break;
    }
    setCurrent(page);
  }, []);

  const zoomIndex = ZOOMS.indexOf(zoom);
  const pages = doc?.numPages ?? 0;

  return (
    <div className="flex h-full flex-col" data-testid="pdf-viewer">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
        <span aria-live="polite" className="tabular-nums text-muted-foreground" data-testid="pdf-page-indicator">
          {pages ? `Page ${current} of ${pages}` : 'Loading…'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Zoom out"
            disabled={!doc || zoomIndex <= 0}
            onClick={() => setZoom(ZOOMS[Math.max(0, zoomIndex - 1)]!)}
          >
            <IconZoomOut className="h-4 w-4" aria-hidden />
          </Button>
          <span className="w-10 text-center tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Zoom in"
            disabled={!doc || zoomIndex >= ZOOMS.length - 1}
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)]!)}
          >
            <IconZoomIn className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Fit to width"
            disabled={!doc || zoom === 1}
            onClick={() => setZoom(1)}
          >
            <IconArrowsHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative h-[78vh] min-h-[28rem] overflow-auto bg-muted/50"
        // Discourage "Save image as…" on the page canvases.
        onContextMenu={(e) => e.preventDefault()}
        role="document"
        aria-label={`Preview of ${title}`}
        tabIndex={0}
      >
        {error === 'password' ? (
          <Message icon={<IconLock className="h-8 w-8 text-amber-600" aria-hidden />} title="This PDF is password-protected">
            It can&apos;t be shown in the browser. Ask the uploader for an unprotected copy.
          </Message>
        ) : error ? (
          <Message icon={<IconAlertTriangle className="h-8 w-8 text-destructive" aria-hidden />} title="The PDF could not be shown">
            <Button type="button" variant="outline" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>
              <IconRefresh className="mr-1.5 h-4 w-4" aria-hidden /> Try again
            </Button>
          </Message>
        ) : !doc || !base || scale <= 0 ? (
          <Message icon={<IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />} title="Loading PDF…" />
        ) : (
          <div className="flex min-w-fit flex-col items-center gap-3 px-4 py-4">
            {Array.from({ length: pages }, (_, i) => (
              <PdfPage
                key={i + 1}
                doc={doc}
                pageNumber={i + 1}
                pageCount={pages}
                scale={scale}
                estimate={{ w: base.w * scale, h: base.h * scale }}
                root={scrollRef}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-2 px-6 text-center">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children ? <div className="max-w-sm text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  pageCount,
  scale,
  estimate,
  root,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  pageCount: number;
  scale: number;
  estimate: { w: number; h: number };
  root: React.RefObject<HTMLDivElement | null>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [state, setState] = useState<'idle' | 'rendering' | 'rendered' | 'error'>('idle');
  const [everRendered, setEverRendered] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNear(Boolean(entry?.isIntersecting)), {
      root: root.current,
      rootMargin: NEAR_MARGIN,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!near || !canvas) {
      // Far away: free the bitmap (long documents on phones).
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      setState((s) => (s === 'rendered' || s === 'rendering' ? 'idle' : s));
      return;
    }
    let cancelled = false;
    let task: RenderTask | null = null;
    setState('rendering');
    void doc
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        setSize({ w: viewport.width, h: viewport.height });
        task = page.render({ canvas, viewport: page.getViewport({ scale: scale * ratio }) });
        return task.promise.then(() => {
          if (cancelled) return;
          setState('rendered');
          setEverRendered(true);
        });
      })
      .catch((err: unknown) => {
        if (cancelled || (err as { name?: string })?.name === 'RenderingCancelledException') return;
        setState('error');
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, doc, pageNumber, scale]);

  const w = Math.floor(size?.w ?? estimate.w);
  const h = Math.floor(size?.h ?? estimate.h);
  return (
    <div
      ref={boxRef}
      data-pdf-page={pageNumber}
      data-state={state}
      data-ever-rendered={everRendered ? 'true' : undefined}
      className="relative shrink-0 bg-white shadow-sm ring-1 ring-black/5"
      style={{ width: w, height: h }}
    >
      <canvas ref={canvasRef} role="img" aria-label={`Page ${pageNumber} of ${pageCount}`} className="block" />
      {state === 'error' ? (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Page {pageNumber} could not be drawn
        </p>
      ) : null}
    </div>
  );
}
