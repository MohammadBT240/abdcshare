'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppSelect, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { BffClientError, bffApi } from '@/lib/bff/client';
import { useTransferLibrary } from '@/features/library/hooks/use-library';

const OWNER_ROLES = new Set(['Staff', 'Super Admin', 'Platform Admin']);

/** Active internal users who can own library content (for curators' transfer pickers). */
export function useLibraryOwnerOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['library', 'owner-options'],
    queryFn: async () => {
      const res = await bffApi<{ data: { id: string; fullName: string; email: string; role: string }[] }>(
        '/api/users?isActive=true&page=1&pageSize=100&sort=fullName',
      );
      return res.data.filter((u) => OWNER_ROLES.has(u.role));
    },
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Transfer ownership (S3, D29) — curators only. `target` is one item, one collection, or
 * everything a (usually deactivated) user owns.
 */
export function TransferOwnerDialog({
  target,
  open,
  onOpenChange,
}: {
  target:
    | { kind: 'item' | 'collection'; id: string; title: string; ownerId: string; ownerName: string }
    | { kind: 'all'; fromUserId: string; fromName: string; items: number; collections: number }
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const transfer = useTransferLibrary();
  const users = useLibraryOwnerOptions(open);
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUserId('');
      setError(null);
    }
  }, [open]);

  if (!target) return null;
  const currentOwner = target.kind === 'all' ? target.fromUserId : target.ownerId;
  const options = (users.data ?? [])
    .filter((u) => u.id !== currentOwner)
    .map((u) => ({ value: u.id, label: `${u.fullName} (${u.email})` }));

  async function submit() {
    if (!target) return;
    if (!userId) return setError('Choose the new owner');
    try {
      const res =
        target.kind === 'all'
          ? await transfer.mutateAsync({ kind: 'all', fromUserId: target.fromUserId, toUserId: userId })
          : await transfer.mutateAsync({ kind: target.kind, id: target.id, userId });
      const parts = [
        res.items ? `${res.items} item${res.items === 1 ? '' : 's'}` : null,
        res.collections ? `${res.collections} collection${res.collections === 1 ? '' : 's'}` : null,
      ].filter(Boolean);
      toast.success(parts.length ? `Transferred ${parts.join(' and ')}` : 'Nothing to transfer');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof BffClientError ? err.message : 'Transfer failed');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !transfer.isPending && onOpenChange(next)}
      title="Transfer ownership"
      description={
        target.kind === 'all'
          ? `Move everything ${target.fromName} owns in the library — ${target.items} item(s) and ${target.collections} collection(s) — to someone else.`
          : `“${target.title}” is owned by ${target.ownerName}. The new owner can edit, replace and archive it.`
      }
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={transfer.isPending}>
            Cancel
          </Button>
          <LoadingButton type="button" loading={transfer.isPending} onClick={() => void submit()}>
            Transfer
          </LoadingButton>
        </>
      }
    >
      <FormField label="New owner" required>
        <AppSelect
          options={options}
          value={userId}
          onValueChange={setUserId}
          placeholder="Choose a person"
          isLoading={users.isPending}
          disabled={transfer.isPending}
        />
      </FormField>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}
