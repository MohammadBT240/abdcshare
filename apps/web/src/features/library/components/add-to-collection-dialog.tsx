'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AppSelect, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BffClientError } from '@/lib/bff/client';
import { useCollectionMutations, useEditableCollections } from '@/features/library/hooks/use-library-collections';
import type { LibraryItem } from '@/features/library/types';

/** From an item page: put this item in one of my collections. */
export function AddToCollectionDialog({
  item,
  open,
  onOpenChange,
}: {
  item: LibraryItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editable = useEditableCollections(open);
  const { addItems } = useCollectionMutations();
  const [collectionId, setCollectionId] = useState('');
  const [section, setSection] = useState('');
  const options = (editable.data ?? [])
    .filter((c) => !item.collections.some((m) => m.id === c.id))
    .map((c) => ({ value: c.id, label: c.title }));

  async function submit() {
    try {
      await addItems.mutateAsync({ id: collectionId, itemIds: [item.id], section: section.trim() || null });
      toast.success('Added to the collection');
      setCollectionId('');
      setSection('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not add to the collection');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !addItems.isPending && onOpenChange(next)}
      title="Add to a collection"
      description={item.title}
      maxWidthClass="sm:max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="button" loading={addItems.isPending} disabled={!collectionId} onClick={() => void submit()}>
            Add
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Collection" required hint={options.length || editable.isPending ? undefined : 'You have no other collections to add to.'}>
          <AppSelect options={options} value={collectionId} onValueChange={setCollectionId} placeholder="Choose a collection" isLoading={editable.isPending} />
        </FormField>
        <FormField label="Section" htmlFor="add-to-collection-section" hint="Optional, e.g. “Day 2”.">
          <Input id="add-to-collection-section" value={section} maxLength={80} onChange={(e) => setSection(e.target.value)} />
        </FormField>
      </div>
    </FormDialog>
  );
}
