'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconPlus, IconTrash, IconCrown } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormDialog, FormField, LoadingButton, MultiCombobox } from '@/components/forms';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';
import { UserAvatar } from '@/components/data/user-avatar';
import { BffClientError } from '@/lib/bff/client';
import {
  useAddTeamMember,
  useElevateTeamMember,
  useRemoveTeamMember,
} from '@/features/engagements/hooks/use-engagements';
import { useUsersList } from '@/features/users/hooks/use-users';
import type { EngagementWorkspace } from '@/features/engagements/hooks/use-engagements';

interface TeamPanelProps {
  workspace: EngagementWorkspace;
  canManageTeam: boolean;
}

export function TeamPanel({ workspace, canManageTeam }: TeamPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [elevatingUserId, setElevatingUserId] = useState<string | null>(null);

  const addMember = useAddTeamMember(workspace.id);
  const elevateMember = useElevateTeamMember(workspace.id);
  const removeMember = useRemoveTeamMember(workspace.id);
  const users = useUsersList('pageSize=100&isActive=true');

  const leadCount = workspace.team.filter((m) => m.memberRole === 'Lead').length;

  async function handleAddMembers() {
    if (selectedUserIds.length === 0) {
      toast.error('Select at least one person');
      return;
    }
    try {
      for (const userId of selectedUserIds) {
        await addMember.mutateAsync({ userId, memberRole: 'Member' });
      }
      toast.success(
        selectedUserIds.length === 1
          ? 'Team member added'
          : `${selectedUserIds.length} team members added`,
      );
      setAddDialogOpen(false);
      setSelectedUserIds([]);
    } catch (err) {
      const message = err instanceof BffClientError ? err.message : 'Failed to add member';
      toast.error(message);
    }
  }

  async function handleElevateMember() {
    if (!elevatingUserId) return;
    try {
      await elevateMember.mutateAsync(elevatingUserId);
      toast.success('Team Lead updated');
      setElevatingUserId(null);
    } catch (err) {
      const message = err instanceof BffClientError ? err.message : 'Failed to elevate member';
      toast.error(message);
    }
  }

  async function handleRemoveMember() {
    if (!removingUserId) return;
    try {
      await removeMember.mutateAsync(removingUserId);
      toast.success('Team member removed');
      setRemovingUserId(null);
    } catch (err) {
      const message = err instanceof BffClientError ? err.message : 'Failed to remove member';
      toast.error(message);
    }
  }

  const availableUsers = (users.data?.data ?? []).filter(
    (u) =>
      (u.role === 'Staff' || u.role === 'Super Admin') &&
      !workspace.team.some((tm) => tm.userId === u.id),
  );

  return (
    <>
      <section className="h-full rounded-md border border-border bg-card/40 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Team</h3>
            <p className="text-xs text-muted-foreground">{workspace.team.length} members</p>
          </div>
          {canManageTeam ? (
            <Button
              onClick={() => {
                setSelectedUserIds([]);
                setAddDialogOpen(true);
              }}
              size="sm"
            >
              <IconPlus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>
        {workspace.team.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto pr-1">
            {workspace.team.map((member) => {
              const isSoleLead =
                member.memberRole === 'Lead' && leadCount <= 1;
              return (
                <li key={member.userId} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar
                      src={member.avatarUrl}
                      initials={member.fullName.slice(0, 2)}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge
                      variant={member.memberRole === 'Lead' ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {member.memberRole}
                    </Badge>
                    {canManageTeam && member.memberRole === 'Member' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-xs"
                        title="Make Lead"
                        onClick={() => setElevatingUserId(member.userId)}
                      >
                        <IconCrown className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {canManageTeam ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={isSoleLead}
                        title={
                          isSoleLead
                            ? 'Elevate someone else to Lead before removing'
                            : 'Remove'
                        }
                        onClick={() => setRemovingUserId(member.userId)}
                      >
                        <IconTrash className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="Add team members"
        description="Search and select one or more staff to add as Members."
        maxWidthClass="sm:max-w-md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={addMember.isPending}
            >
              Cancel
            </Button>
            <LoadingButton
              onClick={() => void handleAddMembers()}
              loading={addMember.isPending}
              disabled={selectedUserIds.length === 0}
            >
              {selectedUserIds.length > 1
                ? `Add ${selectedUserIds.length} members`
                : 'Add member'}
            </LoadingButton>
          </>
        }
      >
        <FormField
          label="Staff"
          required
          description="New members join as Member. Use Make Lead to elevate someone."
        >
          <MultiCombobox
            values={selectedUserIds}
            onValuesChange={setSelectedUserIds}
            options={availableUsers.map((u) => ({
              value: u.id,
              label: u.fullName,
              description: u.email ? `${u.role} · ${u.email}` : u.role,
              avatarUrl: u.avatarUrl,
            }))}
            placeholder="Search and select staff…"
            searchPlaceholder="Search staff…"
            emptyMessage="No matching staff"
            isLoading={users.isPending}
          />
        </FormField>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(elevatingUserId)}
        onOpenChange={(open) => !open && setElevatingUserId(null)}
        title="Make Team Lead"
        description="This person becomes the Lead for this engagement. The current Lead becomes a Member."
        onConfirm={handleElevateMember}
        confirmLabel="Make Lead"
        confirming={elevateMember.isPending}
      />

      <ConfirmDialog
        open={Boolean(removingUserId)}
        onOpenChange={(open) => !open && setRemovingUserId(null)}
        title="Remove team member"
        description="Are you sure you want to remove this member from the team?"
        onConfirm={handleRemoveMember}
        confirmLabel="Remove"
        variant="destructive"
        confirming={removeMember.isPending}
      />
    </>
  );
}
