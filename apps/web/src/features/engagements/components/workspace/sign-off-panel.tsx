'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IconCheck, IconMessageCircle, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import { useCreateSignOff, useRevokeSignOff } from '@/features/engagements/hooks/use-engagements';
import type { EngagementWorkspace, SignOff } from '@/features/engagements/hooks/use-engagements';

interface SignOffPanelProps {
  workspace: EngagementWorkspace;
  canSignOff: boolean;
  currentUserId?: string;
}

export function SignOffPanel({ workspace, canSignOff, currentUserId }: SignOffPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState('');

  const createSignOff = useCreateSignOff(workspace.id);
  const revokeSignOff = useRevokeSignOff(workspace.id);

  const activeSignOffs = useMemo(
    () => (workspace.signOffs ?? []).filter((s) => !s.revoked),
    [workspace.signOffs],
  );

  const myWideSignOff = activeSignOffs.find(
    (s) => s.signedById === currentUserId && s.requestClassId == null,
  );

  async function handleWideSignOff() {
    try {
      await createSignOff.mutateAsync({ note: note.trim() || undefined });
      toast.success('Engagement signed off');
      setDialogOpen(false);
      setNote('');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to sign off');
    }
  }

  async function handleRevoke(signOff: SignOff) {
    try {
      await revokeSignOff.mutateAsync({ signOffId: signOff.id });
      toast.success('Sign-off revoked');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to revoke sign-off');
    }
  }

  return (
    <>
      <section className="h-full rounded-md border border-border bg-card/40 px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Sign-offs</h3>
            <p className="text-xs text-muted-foreground">
              Classes or engagement-wide before completion
            </p>
          </div>
          {canSignOff ? (
            myWideSignOff ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRevoke(myWideSignOff)}
                disabled={revokeSignOff.isPending}
              >
                <IconX className="mr-1.5 h-4 w-4" />
                Revoke engagement
              </Button>
            ) : (
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <IconCheck className="mr-1.5 h-4 w-4" />
                Sign off engagement
              </Button>
            )
          ) : null}
        </div>
        {activeSignOffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-offs yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activeSignOffs.map((signOff) => (
              <li
                key={signOff.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm"
              >
                <span className="font-medium">
                  {signOff.requestClassName ?? 'Entire engagement'}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {signOff.requestClassId == null ? 'Engagement' : 'Class'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {signOff.signedByName ?? 'Unknown'} ·{' '}
                  {new Date(signOff.signedAt).toLocaleString()}
                </span>
                {signOff.note ? (
                  <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <IconMessageCircle className="h-3 w-3 shrink-0" />
                    <span className="truncate">{signOff.note}</span>
                  </span>
                ) : null}
                {canSignOff && signOff.signedById === currentUserId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 w-7 p-0"
                    onClick={() => void handleRevoke(signOff)}
                    disabled={revokeSignOff.isPending}
                    aria-label="Revoke sign-off"
                  >
                    <IconX className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <FormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setNote('');
          setDialogOpen(open);
        }}
        title="Sign off engagement"
        description="Marks every in-scope request class as signed off for completion."
        maxWidthClass="sm:max-w-md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createSignOff.isPending}
            >
              Cancel
            </Button>
            <LoadingButton onClick={() => void handleWideSignOff()} loading={createSignOff.isPending}>
              Sign off
            </LoadingButton>
          </>
        }
      >
        <FormField label="Note (optional)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note…"
            rows={3}
            maxLength={500}
          />
        </FormField>
      </FormDialog>
    </>
  );
}
