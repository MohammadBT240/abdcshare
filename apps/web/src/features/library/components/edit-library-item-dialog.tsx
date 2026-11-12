'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormDialog, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { BffClientError } from '@/lib/bff/client';
import { useUpdateLibraryItem } from '@/features/library/hooks/use-library';
import {
  EMPTY_LIBRARY_FORM,
  LibraryItemFieldsForm,
  fieldsFromForm,
  formFromItem,
  validateLibraryForm,
  type LibraryFormState,
} from '@/features/library/components/library-item-fields';
import type { LibraryItem } from '@/features/library/types';

const FORM_ID = 'edit-library-item-form';

export function EditLibraryItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: LibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateLibraryItem();
  const [form, setForm] = useState<LibraryFormState>(EMPTY_LIBRARY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && item) {
      setForm(formFromItem(item));
      setError(null);
    }
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    const invalid = validateLibraryForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    try {
      await update.mutateAsync({ id: item.id, fields: fieldsFromForm(form) });
      toast.success('Details saved');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof BffClientError ? err.message : 'Save failed');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !update.isPending && onOpenChange(next)}
      title="Edit details"
      description={item?.fileName ?? undefined}
      maxWidthClass="sm:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={FORM_ID} loading={update.isPending}>
            Save
          </LoadingButton>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <LibraryItemFieldsForm value={form} onChange={setForm} disabled={update.isPending} />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </FormDialog>
  );
}
