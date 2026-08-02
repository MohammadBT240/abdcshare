import type { EntityManager } from '@mikro-orm/postgresql';
import { EngagementTeamMemberEntity } from '../engagements/infrastructure/persistence/engagement-team-member.entity';
import { RequestAssigneeEntity } from '../requests/infrastructure/persistence/request-assignee.entity';
import { ClientEntity } from '../clients/infrastructure/persistence/client.entity';
import type { NotifyRecipient } from './notifications.service';
import type { UserEntity } from '../users/infrastructure/persistence/user.entity';

function toRecipient(user: UserEntity | null | undefined): NotifyRecipient | null {
  if (!user?.id) return null;
  return { userId: user.id, email: user.email ?? null };
}

function dedupe(recipients: NotifyRecipient[]): NotifyRecipient[] {
  const seen = new Set<string>();
  const out: NotifyRecipient[] = [];
  for (const r of recipients) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    out.push(r);
  }
  return out;
}

/** All users on the engagement team. */
export async function engagementTeamRecipients(
  em: EntityManager,
  engagementId: string,
): Promise<NotifyRecipient[]> {
  const members = await em.find(
    EngagementTeamMemberEntity,
    { engagement: engagementId },
    { populate: ['user'] },
  );
  return dedupe(
    members.map((m) => toRecipient(m.user)).filter((r): r is NotifyRecipient => r != null),
  );
}

/** Assignees on a request. */
export async function requestAssigneeRecipients(
  em: EntityManager,
  requestId: string,
): Promise<NotifyRecipient[]> {
  const rows = await em.find(
    RequestAssigneeEntity,
    { request: requestId },
    { populate: ['user'] },
  );
  return dedupe(rows.map((a) => toRecipient(a.user)).filter((r): r is NotifyRecipient => r != null));
}

/** Client primary contact, if set. */
export async function clientPrimaryContactRecipient(
  em: EntityManager,
  clientId: string,
): Promise<NotifyRecipient | null> {
  const client = await em.findOne(ClientEntity, { id: clientId }, { populate: ['primaryContact'] });
  return toRecipient(client?.primaryContact ?? null);
}

/**
 * Prefer assignees when present; otherwise engagement team.
 * Used for request create (no assignees), update, stage, and status changes.
 */
export async function assigneesOrTeamRecipients(
  em: EntityManager,
  opts: { requestId: string; engagementId: string },
): Promise<NotifyRecipient[]> {
  const assignees = await requestAssigneeRecipients(em, opts.requestId);
  if (assignees.length > 0) return assignees;
  return engagementTeamRecipients(em, opts.engagementId);
}

/** Merge recipient lists and dedupe. */
export function mergeRecipients(...lists: NotifyRecipient[][]): NotifyRecipient[] {
  return dedupe(lists.flat());
}
