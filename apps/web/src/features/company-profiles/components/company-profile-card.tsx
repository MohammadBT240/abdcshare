'use client';

import { IconDownload, IconFileTypePdf, IconFileTypeDoc, IconFile, IconPencil, IconReplace, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CompanyProfileRecord } from '@/features/company-profiles/hooks/use-company-profiles';
import { formatFileSize, formatProfileDate } from '@/features/company-profiles/lib/format';

function fileKind(mime?: string | null, fileName?: string) {
  const lower = `${mime ?? ''} ${fileName ?? ''}`.toLowerCase();
  if (lower.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf')) {
    return {
      label: 'PDF',
      Icon: IconFileTypePdf,
      badge: 'bg-red-50 text-red-700 ring-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
      tile: 'bg-gradient-to-br from-red-500/15 to-primary/10 text-red-700 dark:text-red-300',
    };
  }
  if (lower.includes('word') || lower.includes('msword') || /\.docx?$/.test(fileName?.toLowerCase() ?? '')) {
    return {
      label: 'DOC',
      Icon: IconFileTypeDoc,
      badge: 'bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
      tile: 'bg-gradient-to-br from-sky-500/15 to-primary/10 text-sky-800 dark:text-sky-300',
    };
  }
  return {
    label: 'FILE',
    Icon: IconFile,
    badge: 'bg-primary/10 text-primary ring-primary/20',
    tile: 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary',
  };
}

function IconAction({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={label}
          onClick={onClick}
          className={cn('h-8 w-8 p-0 text-muted-foreground hover:text-foreground', className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function CompanyProfileCard({
  profile,
  canManage,
  onDownload,
  onRename,
  onReplace,
  onRemove,
  className,
}: {
  profile: CompanyProfileRecord;
  canManage: boolean;
  onDownload: () => void;
  onRename: () => void;
  onReplace: () => void;
  onRemove: () => void;
  className?: string;
}) {
  const kind = fileKind(profile.mimeType, profile.fileName);
  const KindIcon = kind.Icon;

  return (
    <TooltipProvider delayDuration={200}>
      <article
        className={cn(
          'group relative flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--shadow-aca)] transition-all',
          'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md',
          className,
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-emerald-400/80" aria-hidden />

        <div className="flex items-start gap-3 p-4 pb-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
              kind.tile,
              'ring-black/5 dark:ring-white/10',
            )}
          >
            <KindIcon className="h-6 w-6" aria-hidden />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 truncate text-base font-semibold leading-snug text-foreground">
                {profile.name}
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Download"
                    onClick={onDownload}
                    className="h-8 w-8 shrink-0 p-0 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <IconDownload className="h-[18px] w-[18px]" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Download</TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset',
                  kind.badge,
                )}
              >
                {kind.label}
              </span>
              <p className="truncate text-sm text-muted-foreground">{profile.fileName}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/70 bg-muted/40 px-4 py-2.5">
          <dl className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <dt className="sr-only">Size</dt>
              <dd className="font-medium text-foreground/80">{formatFileSize(profile.sizeBytes)}</dd>
              <span aria-hidden className="text-border">
                ·
              </span>
              <dt className="sr-only">Uploaded</dt>
              <dd>{formatProfileDate(profile.createdAt)}</dd>
            </div>
            {profile.createdByName ? (
              <div className="truncate">
                <dt className="sr-only">Uploaded by</dt>
                <dd>By {profile.createdByName}</dd>
              </div>
            ) : null}
          </dl>

          {canManage ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <IconAction label="Rename" onClick={onRename}>
                <IconPencil className="h-4 w-4" aria-hidden />
              </IconAction>
              <IconAction label="Replace file" onClick={onReplace}>
                <IconReplace className="h-4 w-4" aria-hidden />
              </IconAction>
              <IconAction
                label="Remove"
                onClick={onRemove}
                className="text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
              >
                <IconTrash className="h-4 w-4" aria-hidden />
              </IconAction>
            </div>
          ) : null}
        </div>
      </article>
    </TooltipProvider>
  );
}
