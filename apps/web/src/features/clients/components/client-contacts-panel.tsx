'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  IconCrown,
  IconKey,
  IconPencil,
  IconPlus,
  IconUserOff,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';
import { UserAvatar } from '@/components/data/user-avatar';
import { cn } from '@/lib/utils';
import { BffClientError } from '@/lib/bff/client';
import {
  useAddClientContact,
  useClientContacts,
  useDeactivateClientContact,
  useResetClientContactUserPassword,
  useSetPrimaryClientContact,
  useUpdateClientContact,
  type ClientContactRecord,
} from '@/features/clients/hooks/use-clients';

interface ClientContactsPanelProps {
  clientId: string;
  canManage: boolean;
  /** When true, panel is the sole place to manage portal logins (corporate). */
  className?: string;
}

type ContactDraft = {
  firstName: string;
  surname: string;
  email: string;
  phone: string;
};

const emptyDraft: ContactDraft = {
  firstName: '',
  surname: '',
  email: '',
  phone: '',
};

export function ClientContactsPanel({
  clientId,
  canManage,
  className,
}: ClientContactsPanelProps) {
  const contacts = useClientContacts(clientId);
  const addContact = useAddClientContact(clientId);
  const updateContact = useUpdateClientContact(clientId);
  const setPrimary = useSetPrimaryClientContact(clientId);
  const resetPassword = useResetClientContactUserPassword(clientId);
  const deactivate = useDeactivateClientContact(clientId);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientContactRecord | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [primaryTarget, setPrimaryTarget] = useState<ClientContactRecord | null>(null);
  const [resetTarget, setResetTarget] = useState<ClientContactRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ClientContactRecord | null>(null);

  const rows = contacts.data ?? [];
  const { active, inactive } = useMemo(() => {
    const a: ClientContactRecord[] = [];
    const i: ClientContactRecord[] = [];
    for (const c of rows) {
      if (c.isActive) a.push(c);
      else i.push(c);
    }
    a.sort((x, y) => Number(y.isPrimary) - Number(x.isPrimary) || x.fullName.localeCompare(y.fullName));
    return { active: a, inactive: i };
  }, [rows]);

  function openAdd() {
    setDraft(emptyDraft);
    setAddOpen(true);
  }

  function openEdit(c: ClientContactRecord) {
    setEditTarget(c);
    setDraft({
      firstName: c.firstName,
      surname: c.surname,
      email: c.email,
      phone: c.phoneNumber ?? '',
    });
  }

  async function handleAdd() {
    if (!draft.firstName.trim() || !draft.surname.trim() || !draft.email.trim()) {
      toast.error('First name, surname, and email are required');
      return;
    }
    try {
      await addContact.mutateAsync({
        firstName: draft.firstName.trim(),
        surname: draft.surname.trim(),
        email: draft.email.trim(),
        phoneNumber: draft.phone.trim() || undefined,
      });
      toast.success('Contact added — credentials emailed');
      setAddOpen(false);
      setDraft(emptyDraft);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to add contact');
    }
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!draft.firstName.trim() || !draft.surname.trim() || !draft.email.trim()) {
      toast.error('First name, surname, and email are required');
      return;
    }
    try {
      await updateContact.mutateAsync({
        userId: editTarget.id,
        firstName: draft.firstName.trim(),
        surname: draft.surname.trim(),
        email: draft.email.trim(),
        phoneNumber: draft.phone.trim() || null,
      });
      toast.success('Contact updated');
      setEditTarget(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to update contact');
    }
  }

  return (
    <>
      <section
        className={cn(
          'flex h-full flex-col rounded-md border border-border bg-card/40',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Portal contacts</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              People who can sign in for this client. Mark one as{' '}
              <span className="font-medium text-foreground">Primary</span> — the org default
              for new engagements.
            </p>
          </div>
          {canManage ? (
            <Button type="button" size="sm" className="shrink-0" onClick={openAdd}>
              <IconPlus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>

        <div className="flex-1 px-3 py-3">
          {contacts.isPending ? (
            <p className="px-1 text-sm text-muted-foreground">Loading contacts…</p>
          ) : active.length === 0 && inactive.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium">No contacts yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Add someone to create a portal login and email temporary credentials.
              </p>
              {canManage ? (
                <Button type="button" size="sm" className="mt-1" onClick={openAdd}>
                  <IconPlus className="mr-1.5 h-4 w-4" />
                  Add contact
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2">
              {active.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  canManage={canManage}
                  onEdit={() => openEdit(c)}
                  onSetPrimary={() => setPrimaryTarget(c)}
                  onReset={() => setResetTarget(c)}
                  onDeactivate={() => setDeactivateTarget(c)}
                />
              ))}
              {inactive.length > 0 ? (
                <li className="pt-2">
                  <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Inactive
                  </p>
                  <ul className="space-y-2 opacity-70">
                    {inactive.map((c) => (
                      <ContactCard key={c.id} contact={c} canManage={false} />
                    ))}
                  </ul>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </section>

      <FormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add contact"
        description="Creates a Client portal login and emails temporary credentials."
        footer={
          <LoadingButton loading={addContact.isPending} onClick={() => void handleAdd()}>
            Add contact
          </LoadingButton>
        }
      >
        <ContactDraftFields draft={draft} onChange={setDraft} />
      </FormDialog>

      <FormDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Edit contact"
        description={editTarget?.email}
        footer={
          <LoadingButton loading={updateContact.isPending} onClick={() => void handleEdit()}>
            Save contact
          </LoadingButton>
        }
      >
        <ContactDraftFields draft={draft} onChange={setDraft} />
      </FormDialog>

      <ConfirmDialog
        open={Boolean(primaryTarget)}
        onOpenChange={(open) => {
          if (!open) setPrimaryTarget(null);
        }}
        title="Set as primary contact?"
        description={`${primaryTarget?.fullName ?? 'This contact'} becomes the organisation default for new engagements.`}
        confirmLabel="Set primary"
        confirming={setPrimary.isPending}
        onConfirm={() => {
          if (!primaryTarget) return;
          void setPrimary
            .mutateAsync(primaryTarget.id)
            .then(() => {
              toast.success('Primary contact updated');
              setPrimaryTarget(null);
            })
            .catch((err) =>
              toast.error(err instanceof BffClientError ? err.message : 'Failed to set primary'),
            );
        }}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        title="Reset password and email credentials?"
        description={`A new temporary password will be emailed to ${resetTarget?.email ?? 'this contact'}.`}
        confirmLabel="Reset & email"
        confirming={resetPassword.isPending}
        onConfirm={() => {
          if (!resetTarget) return;
          void resetPassword
            .mutateAsync(resetTarget.id)
            .then(() => {
              toast.success('Password reset emailed');
              setResetTarget(null);
            })
            .catch((err) =>
              toast.error(err instanceof BffClientError ? err.message : 'Password reset failed'),
            );
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Deactivate contact?"
        description={`${deactivateTarget?.fullName ?? 'This contact'} will lose portal access. Remove them from engagements first if still assigned.`}
        confirmLabel="Deactivate"
        variant="destructive"
        confirming={deactivate.isPending}
        onConfirm={() => {
          if (!deactivateTarget) return;
          void deactivate
            .mutateAsync(deactivateTarget.id)
            .then(() => {
              toast.success('Contact deactivated');
              setDeactivateTarget(null);
            })
            .catch((err) =>
              toast.error(err instanceof BffClientError ? err.message : 'Deactivate failed'),
            );
        }}
      />
    </>
  );
}

function ContactDraftFields({
  draft,
  onChange,
}: {
  draft: ContactDraft;
  onChange: (next: ContactDraft) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="First name" required>
        <Input
          value={draft.firstName}
          onChange={(e) => onChange({ ...draft, firstName: e.target.value })}
        />
      </FormField>
      <FormField label="Surname" required>
        <Input
          value={draft.surname}
          onChange={(e) => onChange({ ...draft, surname: e.target.value })}
        />
      </FormField>
      <FormField label="Email" required className="sm:col-span-2">
        <Input
          type="email"
          value={draft.email}
          onChange={(e) => onChange({ ...draft, email: e.target.value })}
        />
      </FormField>
      <FormField label="Phone" className="sm:col-span-2">
        <Input
          value={draft.phone}
          onChange={(e) => onChange({ ...draft, phone: e.target.value })}
        />
      </FormField>
    </div>
  );
}

function ContactCard({
  contact,
  canManage,
  onEdit,
  onSetPrimary,
  onReset,
  onDeactivate,
}: {
  contact: ClientContactRecord;
  canManage: boolean;
  onEdit?: () => void;
  onSetPrimary?: () => void;
  onReset?: () => void;
  onDeactivate?: () => void;
}) {
  return (
    <li
      className={cn(
        'rounded-md border border-border bg-background/80 px-3 py-2.5',
        contact.isPrimary && 'border-primary/25 bg-primary/[0.04]',
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          src={contact.avatarUrl}
          initials={contact.fullName}
          size="md"
          alt={contact.fullName}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{contact.fullName}</p>
            {contact.isPrimary ? (
              <Badge variant="secondary" className="gap-1 font-normal">
                <IconCrown className="h-3 w-3" />
                Primary
              </Badge>
            ) : null}
            {!contact.isActive ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{contact.email}</p>
          {contact.phoneNumber ? (
            <p className="truncate text-xs text-muted-foreground">{contact.phoneNumber}</p>
          ) : null}

          {canManage ? (
            <div className="mt-2 flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onEdit}
              >
                <IconPencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              {!contact.isPrimary ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onSetPrimary}
                >
                  <IconCrown className="mr-1 h-3.5 w-3.5" />
                  Make primary
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onReset}
              >
                <IconKey className="mr-1 h-3.5 w-3.5" />
                Reset password
              </Button>
              {!contact.isPrimary ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={onDeactivate}
                >
                  <IconUserOff className="mr-1 h-3.5 w-3.5" />
                  Deactivate
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
