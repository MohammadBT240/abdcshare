'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IconSearch } from '@tabler/icons-react';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BffClientError } from '@/lib/bff/client';
import { useLibraryItems } from '@/features/library/hooks/use-library';
import { useCollectionMutations } from '@/features/library/hooks/use-library-collections';
import type { LibraryCollection } from '@/features/library/types';

/** Pick existing library items to add to a collection. */
export function AddItemsDialog({
  collection,
  memberIds,
  open,
  onOpenChange,
}: {
  collection: LibraryCollection;
  memberIds: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [section, setSection] = useState('');
  const { addItems } = useCollectionMutations();
  const apiQuery = useMemo(() => {
    const qs = new URLSearchParams({ page: '1', pageSize: '30' });
    if (q.trim()) qs.set('q', q.trim());
    return qs.toString();
  }, [q]);
  const results = useLibraryItems(apiQuery);
  const rows = (results.data?.data ?? []).filter((i) => !memberIds.has(i.id));

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function submit() {
    try {
      const res = await addItems.mutateAsync({ id: collection.id, itemIds: selected, section: section.trim() || null });
      toast.success(`${res.added} item${res.added === 1 ? '' : 's'} added`);
      setSelected([]);
      setSection('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not add items');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !addItems.isPending && onOpenChange(next)}
      title="Add items from the library"
      description={`Adding to “${collection.title}”. Items keep their own access settings.`}
      maxWidthClass="sm:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="button" loading={addItems.isPending} disabled={!selected.length} onClick={() => void submit()}>
            Add {selected.length || ''} item{selected.length === 1 ? '' : 's'}
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library…" className="pl-9" aria-label="Search the library" />
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {results.isPending ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No items found.</li>
          ) : (
            rows.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                  <FileTypeIcon fileName={item.fileName ?? 'document'} mimeType={item.mimeType} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.category.name}
                      {item.authors ? ` · ${item.authors}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
        <FormField label="Section" htmlFor="add-items-section" hint="Optional, e.g. “Day 1”.">
          <Input id="add-items-section" value={section} maxLength={80} onChange={(e) => setSection(e.target.value)} />
        </FormField>
      </div>
    </FormDialog>
  );
}
