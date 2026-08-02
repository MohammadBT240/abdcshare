'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import {
  useCreateSignOff,
  useRemoveRequestClass,
  useRevokeSignOff,
  type EngagementWorkspace,
} from '@/features/engagements/hooks/use-engagements';
import { AddRequestClassDialog } from '@/features/engagements/components/workspace/add-request-class-dialog';

interface RequestClassesPanelProps {
  workspace: EngagementWorkspace;
  canManage: boolean;
  canSignOff: boolean;
  currentUserId?: string;
}

export function RequestClassesPanel({
  workspace,
  canManage,
  canSignOff,
  currentUserId,
}: RequestClassesPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removingClassId, setRemovingClassId] = useState<number | null>(null);
  const [signingClassId, setSigningClassId] = useState<number | null>(null);
  const [signNote, setSignNote] = useState('');

  const removeClass = useRemoveRequestClass(workspace.id);
  const createSignOff = useCreateSignOff(workspace.id);
  const revokeSignOff = useRevokeSignOff(workspace.id);

  const rollups = workspace.classRollups ?? [];
  const activeSignOffs = useMemo(
    () => (workspace.signOffs ?? []).filter((s) => !s.revoked),
    [workspace.signOffs],
  );

  async function handleRemoveClass() {
    if (removingClassId === null) return;
    try {
      await removeClass.mutateAsync(removingClassId);
      toast.success('Request class removed');
      setRemovingClassId(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to remove class');
    }
  }

  async function handleSignOffClass() {
    if (signingClassId === null) return;
    try {
      await createSignOff.mutateAsync({
        requestClassId: signingClassId,
        note: signNote.trim() || undefined,
      });
      toast.success('Request class signed off');
      setSigningClassId(null);
      setSignNote('');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to sign off');
    }
  }

  async function handleRevokeClass(requestClassId: number) {
    const mine = activeSignOffs.find(
      (s) => s.requestClassId === requestClassId && s.signedById === currentUserId,
    );
    if (!mine) {
      toast.error('No sign-off from you to revoke for this class');
      return;
    }
    try {
      await revokeSignOff.mutateAsync({ signOffId: mine.id });
      toast.success('Class sign-off revoked');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to revoke');
    }
  }

  const signingClassName =
    rollups.find((r) => r.requestClassId === signingClassId)?.name ?? 'this class';

  return (
    <>
      <section className="h-full rounded-md border border-border bg-card/40 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Request classes</h3>
            <p className="text-xs text-muted-foreground">{rollups.length} classes</p>
          </div>
          {canManage ? (
            <Button onClick={() => setAddDialogOpen(true)} size="sm">
              <IconPlus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>
        {rollups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No request classes yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {rollups.map((rc) => {
              const classSignOff = activeSignOffs.find(
                (s) => s.requestClassId === rc.requestClassId,
              );
              const canRevokeMine =
                canSignOff &&
                classSignOff != null &&
                classSignOff.signedById === currentUserId;

              return (
                <li key={rc.requestClassId} className="space-y-1.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium">{rc.name}</p>
                        <Badge
                          variant={rc.signedOff ? 'success' : 'secondary'}
                          className="text-[10px]"
                        >
                          {rc.signedOff ? 'Signed off' : 'Open'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rc.done}/{rc.total}
                        {rc.overdue > 0 ? ` · ${rc.overdue} overdue` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {canSignOff && !rc.signedOff ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setSigningClassId(rc.requestClassId)}
                        >
                          <IconCheck className="mr-1 h-3.5 w-3.5" />
                          Sign off
                        </Button>
                      ) : null}
                      {canRevokeMine ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => void handleRevokeClass(rc.requestClassId)}
                          disabled={revokeSignOff.isPending}
                        >
                          Revoke
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setRemovingClassId(rc.requestClassId)}
                          aria-label={`Remove ${rc.name}`}
                        >
                          <IconTrash className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <Progress value={rc.progressPercent} className="h-1" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddRequestClassDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        workspace={workspace}
      />

      <FormDialog
        open={signingClassId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSigningClassId(null);
            setSignNote('');
          }
        }}
        title="Sign off request class"
        description={`Confirm sign-off for ${signingClassName}. Required before completing the engagement (unless you use engagement-wide sign-off).`}
        maxWidthClass="sm:max-w-md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSigningClassId(null);
                setSignNote('');
              }}
              disabled={createSignOff.isPending}
            >
              Cancel
            </Button>
            <LoadingButton onClick={() => void handleSignOffClass()} loading={createSignOff.isPending}>
              Sign off
            </LoadingButton>
          </>
        }
      >
        <FormField label="Note (optional)">
          <Textarea
            value={signNote}
            onChange={(e) => setSignNote(e.target.value)}
            placeholder="Optional note…"
            rows={3}
            maxLength={500}
          />
        </FormField>
      </FormDialog>

      <ConfirmDialog
        open={removingClassId !== null}
        onOpenChange={(open) => !open && setRemovingClassId(null)}
        title="Remove request class"
        description="Are you sure? This will not delete the requests, but they will no longer be grouped under this class."
        onConfirm={handleRemoveClass}
        confirmLabel="Remove"
        variant="destructive"
        confirming={removeClass.isPending}
      />
    </>
  );
}
