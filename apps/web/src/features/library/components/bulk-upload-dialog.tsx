'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { IconCheck, IconLoader2, IconRefresh, IconX } from '@tabler/icons-react';
import { AppSelect, FileUpload, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BffClientError } from '@/lib/bff/client';
import {
  fetchLibraryDuplicates,
  sha256Hex,
  uploadLibraryFile,
  useInvalidateLibrary,
  useLibraryCategories,
} from '@/features/library/hooks/use-library';
import { useEditableCollections } from '@/features/library/hooks/use-library-collections';
import { TagInput } from '@/features/library/components/tag-input';
import { SharingFields, VisibilityPicker } from '@/features/library/components/library-item-fields';
import { DeclarationCheckbox } from '@/features/library/components/declaration-checkbox';
import {
  LIBRARY_ACCEPT,
  LIBRARY_FILE_HINT,
  LIBRARY_MAX_BYTES,
  LIBRARY_TYPES,
  formatBytes,
  titleFromFileName,
  withLibraryMime,
} from '@/features/library/lib/library-files';
import type { LibraryCollection, LibraryDuplicate, LibraryLicence, LibraryVisibility } from '@/features/library/types';

type RowStatus = 'queued' | 'uploading' | 'done' | 'failed';

interface Row {
  key: string;
  file: File;
  title: string;
  status: RowStatus;
  percent: number;
  error?: string;
  draftId?: string | null;
  /** Same file already in the library (D27) — a warning only. */
  duplicates?: LibraryDuplicate[];
}

const CONCURRENCY = 2;
const THIS_YEAR = new Date().getFullYear();

/**
 * Upload many files at once (e.g. everything from a training). Shared details apply to every file;
 * titles are per file. Failed files keep their draft and can be retried without duplicates.
 */
export function BulkUploadDialog({
  open,
  onOpenChange,
  collection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select (and lock) the target collection, e.g. from a collection page. */
  collection?: LibraryCollection | null;
}) {
  const categories = useLibraryCategories();
  const editable = useEditableCollections(open && !collection);
  const invalidate = useInvalidateLibrary();
  const [rows, setRows] = useState<Row[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [year, setYear] = useState('');
  const [visibility, setVisibility] = useState<{ visibility: LibraryVisibility; departmentIds: string[] }>({
    visibility: 'Firm',
    departmentIds: [],
  });
  const [collectionId, setCollectionId] = useState('');
  const [section, setSection] = useState('');
  const [declared, setDeclared] = useState(false);
  const [sharing, setSharing] = useState<{ licence: LibraryLicence; licenceNote: string; viewOnly: boolean }>({
    licence: 'InternalUseOnly',
    licenceNote: '',
    viewOnly: false,
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;

  useEffect(() => {
    if (!open) return;
    setRows([]);
    setCategoryId('');
    setTags([]);
    setYear('');
    setVisibility(
      collection?.visibility === 'Departments'
        ? { visibility: 'Departments', departmentIds: collection.departments.map((d) => String(d.id)) }
        : { visibility: 'Firm', departmentIds: [] },
    );
    setCollectionId(collection?.id ?? '');
    setSection('');
    setDeclared(false);
    setSharing({ licence: 'InternalUseOnly', licenceNote: '', viewOnly: false });
    setError(null);
  }, [open, collection]);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  function addFiles(files: File[]) {
    const normalized = files.map(withLibraryMime);
    const bad = normalized.filter((f) => !LIBRARY_TYPES.has(f.type) || f.size > LIBRARY_MAX_BYTES);
    if (bad.length) setError(`Skipped ${bad.map((f) => f.name).join(', ')} — ${LIBRARY_FILE_HINT}`);
    else setError(null);
    const ok = normalized.filter((f) => !bad.includes(f));
    const fresh = ok
      .filter((f) => !rowsRef.current.some((r) => r.file.name === f.name && r.file.size === f.size))
      .map((f) => ({
        key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
        file: f,
        title: titleFromFileName(f.name),
        status: 'queued' as const,
        percent: 0,
      }));
    setRows((rs) => [...rs, ...fresh]);
    // Duplicate check per file, in the background; failures never block the upload.
    for (const row of fresh) {
      void sha256Hex(row.file)
        .then(fetchLibraryDuplicates)
        .then((duplicates) => duplicates.length && patch(row.key, { duplicates }))
        .catch(() => undefined);
    }
  }

  async function uploadRow(row: Row) {
    patch(row.key, { status: 'uploading', percent: 0, error: undefined });
    try {
      await uploadLibraryFile({
        fields: {
          title: row.title.trim() || titleFromFileName(row.file.name),
          categoryId,
          tags,
          publishedYear: year ? Number(year) : null,
          visibility: visibility.visibility,
          departmentIds: visibility.visibility === 'Departments' ? visibility.departmentIds.map(Number) : [],
          licence: sharing.licence,
          licenceNote: sharing.licenceNote.trim() || null,
          downloadable: !sharing.viewOnly,
          ...(collectionId ? { collectionId, section: section.trim() || null } : {}),
        },
        file: row.file,
        draftId: row.draftId,
        onDraftCreated: (id) => patch(row.key, { draftId: id }),
        onProgress: (p) => patch(row.key, { percent: p }),
        declared: true,
      });
      patch(row.key, { status: 'done', percent: 100 });
    } catch (err) {
      patch(row.key, {
        status: 'failed',
        error: err instanceof BffClientError ? err.message : err instanceof Error ? err.message : 'Upload failed',
      });
    }
  }

  async function run(only?: string[]) {
    if (!categoryId) return setError('Choose a category for these files');
    if (visibility.visibility === 'Departments' && visibility.departmentIds.length === 0) {
      return setError('Choose at least one department, or make them firm-wide');
    }
    if (!declared) return setError('Please confirm the files contain no client-identifiable information');
    setError(null);
    setRunning(true);
    const queue = rowsRef.current.filter((r) => (only ? only.includes(r.key) : r.status === 'queued' || r.status === 'failed'));
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const next = queue[cursor++]!;
        const row = rowsRef.current.find((r) => r.key === next.key);
        if (row) await uploadRow(row);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
    await invalidate();
    const done = rowsRef.current.filter((r) => r.status === 'done').length;
    const failed = rowsRef.current.filter((r) => r.status === 'failed').length;
    if (failed === 0) {
      toast.success(`${done} file${done === 1 ? '' : 's'} added to the library`);
      onOpenChange(false);
    } else {
      toast.error(`${done} uploaded, ${failed} failed — retry the failed files`);
    }
  }

  const pendingCount = rows.filter((r) => r.status === 'queued' || r.status === 'failed').length;
  const doneCount = rows.filter((r) => r.status === 'done').length;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !running && onOpenChange(next)}
      title={collection ? `Upload files to “${collection.title}”` : 'Upload several files'}
      description="Shared details apply to every file. You can change each title before uploading."
      maxWidthClass="sm:max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground">
            {rows.length ? `${doneCount}/${rows.length} uploaded` : null}
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            {doneCount && pendingCount ? 'Close' : 'Cancel'}
          </Button>
          <LoadingButton type="button" loading={running} disabled={pendingCount === 0} onClick={() => void run()}>
            {rows.some((r) => r.status === 'failed') ? `Retry ${pendingCount} file${pendingCount === 1 ? '' : 's'}` : `Upload ${pendingCount} file${pendingCount === 1 ? '' : 's'}`}
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-5">
        <FileUpload
          files={[]}
          onChange={addFiles}
          multiple
          hideFileList
          accept={LIBRARY_ACCEPT}
          maxBytes={LIBRARY_MAX_BYTES}
          disabled={running}
          label="Drop files here"
          description={LIBRARY_FILE_HINT}
        />

        {rows.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Files to upload">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                <FileTypeIcon fileName={r.file.name} mimeType={r.file.type} size={22} />
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label={`Title for ${r.file.name}`}
                    value={r.title}
                    maxLength={300}
                    disabled={running || r.status === 'done'}
                    onChange={(e) => patch(r.key, { title: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {r.file.name} · {formatBytes(r.file.size)}
                    {r.status === 'failed' && r.error ? <span className="text-destructive"> · {r.error}</span> : null}
                  </p>
                  {r.duplicates?.length ? (
                    <p className="mt-0.5 truncate text-[11px] text-amber-700 dark:text-amber-300" data-testid="duplicate-warning">
                      Already in the library:{' '}
                      <Link href={`/library/${r.duplicates[0]!.id}`} target="_blank" className="underline">
                        {r.duplicates[0]!.title}
                      </Link>
                    </p>
                  ) : null}
                  {r.status === 'uploading' ? (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${r.percent}%` }} />
                    </div>
                  ) : null}
                </div>
                <span className="w-16 shrink-0 text-right text-xs" aria-live="polite">
                  {r.status === 'uploading' ? (
                    <IconLoader2 className="ml-auto h-4 w-4 animate-spin text-primary" aria-label="Uploading" />
                  ) : r.status === 'done' ? (
                    <IconCheck className="ml-auto h-4 w-4 text-primary" aria-label="Uploaded" />
                  ) : r.status === 'failed' ? (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={running} onClick={() => void run([r.key])}>
                      <IconRefresh className="mr-1 h-3.5 w-3.5" aria-hidden /> Retry
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={running}
                      aria-label={`Remove ${r.file.name}`}
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category" required>
            <AppSelect
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              value={categoryId}
              onValueChange={setCategoryId}
              placeholder="Choose a category"
              isLoading={categories.isPending}
              disabled={running}
            />
          </FormField>
          <FormField label="Year" htmlFor="bulk-year">
            <Input
              id="bulk-year"
              inputMode="numeric"
              value={year}
              placeholder={String(THIS_YEAR)}
              disabled={running}
              onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            />
          </FormField>
        </div>
        <FormField label="Tags" htmlFor="bulk-tags" hint="Applied to every file.">
          <TagInput id="bulk-tags" value={tags} onChange={setTags} disabled={running} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Collection">
            {collection ? (
              <Input value={collection.title} disabled />
            ) : (
              <AppSelect
                options={[{ value: '', label: 'None' }, ...(editable.data ?? []).map((c) => ({ value: c.id, label: c.title }))]}
                value={collectionId}
                onValueChange={(v) => {
                  setCollectionId(v);
                  const c = editable.data?.find((x) => x.id === v);
                  if (c?.visibility === 'Departments') {
                    setVisibility({ visibility: 'Departments', departmentIds: c.departments.map((d) => String(d.id)) });
                  }
                }}
                isLoading={editable.isPending}
                disabled={running}
              />
            )}
          </FormField>
          <FormField label="Section" htmlFor="bulk-section" hint="Optional, e.g. “Day 1”.">
            <Input
              id="bulk-section"
              value={section}
              maxLength={80}
              disabled={running || !collectionId}
              onChange={(e) => setSection(e.target.value)}
            />
          </FormField>
        </div>
        <VisibilityPicker
          visibility={visibility.visibility}
          departmentIds={visibility.departmentIds}
          onChange={setVisibility}
          disabled={running}
        />
        <SharingFields
          idPrefix="bulk"
          licence={sharing.licence}
          licenceNote={sharing.licenceNote}
          viewOnly={sharing.viewOnly}
          onChange={(next) => setSharing((s) => ({ ...s, ...next }))}
          disabled={running}
        />
        <DeclarationCheckbox checked={declared} onChange={setDeclared} disabled={running} />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
