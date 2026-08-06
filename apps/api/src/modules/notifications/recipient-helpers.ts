import type { EntityManager } from '@mikro-orm/postgresql';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { EngagementTeamMemberEntity } from '../engagements/infrastructure/persistence/engagement-team-member.entity';
import { EngagementClientContactEntity } from '../engagements/infrastructure/persistence/engagement-client-contact.entity';
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

/** Engagement creator (`createdBy`), if set. */
export async function engagementCreatorRecipient(
  em: EntityManager,
  engagementId: string,
): Promise<NotifyRecipient | null> {
  const engagement = await em.findOne(
    EngagementEntity,
    { id: engagementId },
    { populate: ['createdBy'] },
  );
  return toRecipient(engagement?.createdBy ?? null);
}

/**
 * Engagement team members plus the engagement creator (always CC'd).
 * Creator is included even if they are no longer on the team.
 */
export async function engagementTeamRecipients(
  em: EntityManager,
  engagementId: string,
): Promise<NotifyRecipient[]> {
  const members = await em.find(
    EngagementTeamMemberEntity,
    { engagement: engagementId },
    { populate: ['user'] },
  );
  const team = members
    .map((m) => toRecipient(m.user))
    .filter((r): r is NotifyRecipient => r != null);
  const creator = await engagementCreatorRecipient(em, engagementId);
  return mergeRecipients(team, creator ? [creator] : []);
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

/**
 * Assigned client contacts on an engagement.
 * In-app for all; email channel only when `receiveEmail` is true.
 */
export async function engagementClientContactRecipients(
  em: EntityManager,
  engagementId: string,
): Promise<NotifyRecipient[]> {
  const rows = await em.find(
    EngagementClientContactEntity,
    { engagement: engagementId },
    { populate: ['user'] },
  );
  return rows
    .filter((r) => r.user?.id && r.user.isActive !== false)
    .map((r) => ({
      userId: r.user.id,
      email: r.receiveEmail ? (r.user.email ?? null) : null,
      channels: {
        inApp: true,
        email: Boolean(r.receiveEmail),
      },
    }));
}

/** @deprecated Prefer engagementClientContactRecipients — kept for fallback callers. */
export async function clientPrimaryContactRecipient(
  em: EntityManager,
  clientId: string,
): Promise<NotifyRecipient | null> {
  const client = await em.findOne(ClientEntity, { id: clientId }, { populate: ['primaryContact'] });
  return toRecipient(client?.primaryContact ?? null);
}

/**
 * Assignees union engagement team (+ creator).
 * Used for request update, stage, and status changes.
 */
export async function assigneesOrTeamRecipients(
  em: EntityManager,
  opts: { requestId: string; engagementId: string },
): Promise<NotifyRecipient[]> {
  const assignees = await requestAssigneeRecipients(em, opts.requestId);
  const team = await engagementTeamRecipients(em, opts.engagementId);
  return mergeRecipients(assignees, team);
}

/** Merge recipient lists and dedupe. */
export function mergeRecipients(...lists: NotifyRecipient[][]): NotifyRecipient[] {
  return dedupe(lists.flat());
}
