'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IconCrown, IconMail, IconPlus, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDialog, FormField, LoadingButton, MultiCombobox } from '@/components/forms';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';
import { UserAvatar } from '@/components/data/user-avatar';
import { cn } from '@/lib/utils';
import { BffClientError } from '@/lib/bff/client';
import { useClientContacts } from '@/features/clients/hooks/use-clients';
import {
  useAddEngagementClientContact,
  useRemoveEngagementClientContact,
  useUpdateEngagementClientContact,
  type EngagementWorkspace,
} from '@/features/engagements/hooks/use-engagements';

interface ClientContactsPanelProps {
  workspace: EngagementWorkspace;
  canManage: boolean;
}

export function ClientContactsPanel({ workspace, canManage }: ClientContactsPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const orgContacts = useClientContacts(workspace.clientId);
  const addContact = useAddEngagementClientContact(workspace.id);
  const updateContact = useUpdateEngagementClientContact(workspace.id);
  const removeContact = useRemoveEngagementClientContact(workspace.id);

  const assigned = workspace.clientContacts ?? [];
  const mainCount = assigned.filter((c) => c.isMain).length;
  const emailCount = assigned.filter((c) => c.receiveEmail).length;

  const available = useMemo(
    () =>
      (orgContacts.data ?? []).filter(
        (c) => c.isActive && !assigned.some((a) => a.userId === c.id),
      ),
    [orgContacts.data, assigned],
  );

  async function handleAdd() {
    if (selectedUserIds.length === 0) {
      toast.error('Select at least one contact');
      return;
    }
    try {
      for (const userId of selectedUserIds) {
        await addContact.mutateAsync({
          userId,
          isMain: assigned.length === 0 && userId === selectedUserIds[0],
          receiveEmail: assigned.length === 0 && userId === selectedUserIds[0],
        });
      }
      toast.success(
        selectedUserIds.length === 1
          ? 'Client contact added'
          : `${selectedUserIds.length} client contacts added`,
      );
      setAddOpen(false);
      setSelectedUserIds([]);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to add contact');
    }
  }

  async function setMain(userId: string) {
    try {
      await updateContact.mutateAsync({ userId, isMain: true });
      toast.success('Main contact updated');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to set main');
    }
  }

  async function toggleEmail(userId: string, receiveEmail: boolean) {
    try {
      await updateContact.mutateAsync({ userId, receiveEmail });
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to update email flag');
    }
  }

  async function handleRemove() {
    if (!removingUserId) return;
    try {
      await removeContact.mutateAsync(removingUserId);
      toast.success('Client contact removed');
      setRemovingUserId(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to remove contact');
    }
  }

  return (
    <>
      <section className="flex h-full flex-col rounded-md border border-border bg-card/40">
        <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Client contacts</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Who can see this engagement. Everyone gets in-app; email only if flagged.
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setSelectedUserIds([]);
                setAddOpen(true);
              }}
            >
              <IconPlus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>

        <div className="flex-1 px-3 py-2.5">
          {assigned.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">No client contacts assigned</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assigned.map((c) => {
                const isSoleMain = c.isMain && mainCount <= 1;
                const isSoleEmail = c.receiveEmail && emailCount <= 1;
                return (
                  <li
                    key={c.userId}
                    className={cn(
                      'rounded-md border border-border bg-background/80 px-3 py-2.5',
                      c.isMain && 'border-primary/25 bg-primary/[0.04]',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <UserAvatar
                        src={c.avatarUrl}
                        initials={c.fullName}
                        size="sm"
                        alt={c.fullName}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{c.fullName}</p>
                          {c.isMain ? (
                            <Badge variant="secondary" className="gap-1 font-normal">
                              <IconCrown className="h-3 w-3" />
                              Main
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{c.email}</p>

                        {canManage ? (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                              <Checkbox
                                checked={c.receiveEmail}
                                disabled={updateContact.isPending || (isSoleEmail && c.receiveEmail)}
                                onCheckedChange={(checked) =>
                                  void toggleEmail(c.userId, checked === true)
                                }
                              />
                              <IconMail className="h-3.5 w-3.5" />
                              Email alerts
                            </label>
                            {!c.isMain ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => void setMain(c.userId)}
                              >
                                <IconCrown className="mr-1 h-3.5 w-3.5" />
                                Make main
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              disabled={isSoleMain || assigned.length <= 1}
                              onClick={() => setRemovingUserId(c.userId)}
                            >
                              <IconTrash className="mr-1 h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </div>
                        ) : c.receiveEmail ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <IconMail className="h-3.5 w-3.5" />
                            Receives email
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <FormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add client contacts"
        description="Assign contacts from this client organisation. They will be able to see this engagement in the portal."
        footer={
          <LoadingButton loading={addContact.isPending} onClick={() => void handleAdd()}>
            Add
          </LoadingButton>
        }
      >
        <FormField label="Contacts" required>
          <MultiCombobox
            options={available.map((c) => ({
              value: c.id,
              label: c.fullName,
              description: c.email,
            }))}
            values={selectedUserIds}
            onValuesChange={setSelectedUserIds}
            placeholder="Select contacts…"
            searchPlaceholder="Search contacts…"
            emptyMessage={
              orgContacts.isPending ? 'Loading…' : 'No more contacts available'
            }
          />
        </FormField>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(removingUserId)}
        onOpenChange={(open) => {
          if (!open) setRemovingUserId(null);
        }}
        title="Remove client contact?"
        description="They will lose access to this engagement in the portal."
        confirmLabel="Remove"
        variant="destructive"
        confirming={removeContact.isPending}
        onConfirm={() => void handleRemove()}
      />
    </>
  );
}
