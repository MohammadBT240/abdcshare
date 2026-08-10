'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton, AppSelect } from '@/components/forms';
import { Textarea } from '@/components/ui/textarea';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';
import { useUpdateRequestStatus } from '@/features/requests/hooks/use-requests';
import { BffClientError } from '@/lib/bff/client';

export interface ChangeRequestStatusTarget {
  id: string;
  statusId?: number | null;
}

export function ChangeRequestStatusDialog({
  open,
  onOpenChange,
  request,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ChangeRequestStatusTarget | null;
}) {
  const requestId = request?.id ?? '';
  const updateStatus = useUpdateRequestStatus(requestId);
  const statuses = useCatalogueList('request-statuses', 'pageSize=100&isActive=true');
  const [statusId, setStatusId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !request) return;
    setStatusId(request.statusId ? String(request.statusId) : '');
    setNote('');
  }, [open, request]);

  const options = useMemo(
    () =>
      (statuses.data?.data ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    [statuses.data],
  );

  async function onSubmit() {
    if (!request) return;
    if (!statusId) {
      toast.error('Select a status');
      return;
    }
    try {
      await updateStatus.mutateAsync({
        statusId: Number(statusId),
        note: note.trim() || undefined,
      });
      toast.success('Status updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to change status');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change status"
      maxWidthClass="sm:max-w-lg"
      footer={
        <LoadingButton type="button" loading={updateStatus.isPending} onClick={onSubmit}>
          Save
        </LoadingButton>
      }
    >
      <div className="space-y-4">
        <FormField label="Status" required>
          <AppSelect
            value={statusId}
            onValueChange={setStatusId}
            options={options}
            placeholder="Select status"
          />
        </FormField>
        <FormField label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </FormField>
      </div>
    </FormDialog>
  );
}
