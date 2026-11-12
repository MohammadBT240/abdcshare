'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AppSelect, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import { useCollectionMutations } from '@/features/library/hooks/use-library-collections';
import { VisibilityPicker } from '@/features/library/components/library-item-fields';
import { COLLECTION_TYPES } from '@/features/library/lib/collection-types';
import type { LibraryCollection, LibraryCollectionType, LibraryVisibility } from '@/features/library/types';

interface State {
  title: string;
  type: LibraryCollectionType;
  description: string;
  startsOn: string;
  endsOn: string;
  facilitator: string;
  venue: string;
  externalUrl: string;
  visibility: LibraryVisibility;
  departmentIds: string[];
}

const EMPTY: State = {
  title: '',
  type: 'Training',
  description: '',
  startsOn: '',
  endsOn: '',
  facilitator: '',
  venue: '',
  externalUrl: '',
  visibility: 'Firm',
  departmentIds: [],
};

function fromCollection(c: LibraryCollection): State {
  return {
    title: c.title,
    type: c.type,
    description: c.description ?? '',
    startsOn: c.startsOn ?? '',
    endsOn: c.endsOn ?? '',
    facilitator: c.facilitator ?? '',
    venue: c.venue ?? '',
    externalUrl: c.externalUrl ?? '',
    visibility: c.visibility,
    departmentIds: c.departments.map((d) => String(d.id)),
  };
}

const FORM_ID = 'library-collection-form';

/** Create or edit a collection (training, workshop, project…). */
export function CollectionFormDialog({
  open,
  onOpenChange,
  collection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: LibraryCollection | null;
}) {
  const router = useRouter();
  const { create, update } = useCollectionMutations();
  const [form, setForm] = useState<State>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(collection ? fromCollection(collection) : EMPTY);
    setError(null);
  }, [open, collection]);

  const set = <K extends keyof State>(k: K, v: State[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError('Give the collection a title');
    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) return setError('End date is before the start date');
    if (form.externalUrl.trim() && !/^https:\/\//i.test(form.externalUrl.trim())) return setError('Link must start with https://');
    if (form.visibility === 'Departments' && form.departmentIds.length === 0) {
      return setError('Choose at least one department, or make it firm-wide');
    }
    const body = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim() || null,
      startsOn: form.startsOn || null,
      endsOn: form.endsOn || null,
      facilitator: form.facilitator.trim() || null,
      venue: form.venue.trim() || null,
      externalUrl: form.externalUrl.trim() || null,
      visibility: form.visibility,
      departmentIds: form.visibility === 'Departments' ? form.departmentIds.map(Number) : [],
    };
    try {
      if (collection) {
        await update.mutateAsync({ id: collection.id, body });
        toast.success('Collection updated');
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync(body);
        toast.success('Collection created');
        onOpenChange(false);
        router.push(`/library/collections/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof BffClientError ? err.message : 'Save failed');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={collection ? 'Edit collection' : 'New collection'}
      description="Group the files from one training, workshop, conference or project."
      maxWidthClass="sm:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={FORM_ID} loading={pending}>
            {collection ? 'Save' : 'Create collection'}
          </LoadingButton>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-4">
        <FormField label="Title" required htmlFor="collection-title">
          <Input
            id="collection-title"
            value={form.title}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. IFRS 17 training — March 2026"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Type" required>
            <AppSelect
              options={COLLECTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={form.type}
              onValueChange={(v) => set('type', v as LibraryCollectionType)}
            />
          </FormField>
          <FormField label="Starts" htmlFor="collection-starts">
            <Input id="collection-starts" type="date" value={form.startsOn} onChange={(e) => set('startsOn', e.target.value)} />
          </FormField>
          <FormField label="Ends" htmlFor="collection-ends">
            <Input id="collection-ends" type="date" value={form.endsOn} onChange={(e) => set('endsOn', e.target.value)} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Facilitator / lead" htmlFor="collection-facilitator">
            <Input id="collection-facilitator" value={form.facilitator} maxLength={300} onChange={(e) => set('facilitator', e.target.value)} />
          </FormField>
          <FormField label="Venue" htmlFor="collection-venue">
            <Input id="collection-venue" value={form.venue} maxLength={300} onChange={(e) => set('venue', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Link" htmlFor="collection-link" hint="Event page or recording (https://).">
          <Input
            id="collection-link"
            type="url"
            value={form.externalUrl}
            maxLength={2000}
            onChange={(e) => set('externalUrl', e.target.value)}
            placeholder="https://"
          />
        </FormField>
        <FormField label="Description" htmlFor="collection-description">
          <Textarea id="collection-description" rows={3} value={form.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <VisibilityPicker
          visibility={form.visibility}
          departmentIds={form.departmentIds}
          onChange={(v) => setForm((f) => ({ ...f, ...v }))}
          restrictedHint="Only those departments see the collection (items keep their own access)."
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </FormDialog>
  );
}
