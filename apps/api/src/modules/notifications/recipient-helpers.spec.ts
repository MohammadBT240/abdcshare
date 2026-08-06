import {
  assigneesOrTeamRecipients,
  engagementClientContactRecipients,
  engagementCreatorRecipient,
  engagementTeamRecipients,
  mergeRecipients,
  requestAssigneeRecipients,
} from './recipient-helpers';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { EngagementTeamMemberEntity } from '../engagements/infrastructure/persistence/engagement-team-member.entity';
import { EngagementClientContactEntity } from '../engagements/infrastructure/persistence/engagement-client-contact.entity';
import { RequestAssigneeEntity } from '../requests/infrastructure/persistence/request-assignee.entity';

describe('recipient-helpers', () => {
  it('engagementCreatorRecipient maps createdBy', async () => {
    const em = {
      findOne: jest.fn(async () => ({ createdBy: { id: 'c1', email: 'c@x.com' } })),
    };
    await expect(engagementCreatorRecipient(em as never, 'eng-1')).resolves.toEqual({
      userId: 'c1',
      email: 'c@x.com',
    });
    expect(em.findOne).toHaveBeenCalledWith(
      EngagementEntity,
      { id: 'eng-1' },
      { populate: ['createdBy'] },
    );
  });

  it('engagementTeamRecipients maps team users, CCs creator, and dedupes', async () => {
    const em = {
      find: jest.fn(async () => [
        { user: { id: 'u1', email: 'a@x.com' } },
        { user: { id: 'u1', email: 'a@x.com' } },
        { user: { id: 'u2', email: null } },
      ]),
      findOne: jest.fn(async () => ({ createdBy: { id: 'c1', email: 'c@x.com' } })),
    };
    const rows = await engagementTeamRecipients(em as never, 'eng-1');
    expect(rows).toEqual([
      { userId: 'u1', email: 'a@x.com' },
      { userId: 'u2', email: null },
      { userId: 'c1', email: 'c@x.com' },
    ]);
    expect(em.find).toHaveBeenCalledWith(
      EngagementTeamMemberEntity,
      { engagement: 'eng-1' },
      { populate: ['user'] },
    );
  });

  it('engagementTeamRecipients includes creator even when not on team', async () => {
    const em = {
      find: jest.fn(async () => [{ user: { id: 't1', email: 't@x.com' } }]),
      findOne: jest.fn(async () => ({ createdBy: { id: 'c1', email: 'c@x.com' } })),
    };
    const rows = await engagementTeamRecipients(em as never, 'eng-1');
    expect(rows).toEqual([
      { userId: 't1', email: 't@x.com' },
      { userId: 'c1', email: 'c@x.com' },
    ]);
  });

  it('requestAssigneeRecipients maps assignees', async () => {
    const em = {
      find: jest.fn(async () => [{ user: { id: 'a1', email: 'a@x.com' } }]),
    };
    await expect(requestAssigneeRecipients(em as never, 'req-1')).resolves.toEqual([
      { userId: 'a1', email: 'a@x.com' },
    ]);
    expect(em.find).toHaveBeenCalledWith(
      RequestAssigneeEntity,
      { request: 'req-1' },
      { populate: ['user'] },
    );
  });

  it('assigneesOrTeamRecipients unions assignees with team and creator', async () => {
    const em = {
      find: jest
        .fn()
        .mockResolvedValueOnce([{ user: { id: 'a1', email: 'a@x.com' } }]) // assignees
        .mockResolvedValueOnce([{ user: { id: 't1', email: 't@x.com' } }]), // team
      findOne: jest.fn(async () => ({ createdBy: { id: 'c1', email: 'c@x.com' } })),
    };
    const rows = await assigneesOrTeamRecipients(em as never, {
      requestId: 'r1',
      engagementId: 'e1',
    });
    expect(rows).toEqual([
      { userId: 'a1', email: 'a@x.com' },
      { userId: 't1', email: 't@x.com' },
      { userId: 'c1', email: 'c@x.com' },
    ]);
    expect(em.find).toHaveBeenCalledTimes(2);
  });

  it('assigneesOrTeamRecipients falls back to team+creator when no assignees', async () => {
    const em = {
      find: jest
        .fn()
        .mockResolvedValueOnce([]) // assignees
        .mockResolvedValueOnce([{ user: { id: 't1', email: 't@x.com' } }]),
      findOne: jest.fn(async () => ({ createdBy: { id: 'c1', email: 'c@x.com' } })),
    };
    const rows = await assigneesOrTeamRecipients(em as never, {
      requestId: 'r1',
      engagementId: 'e1',
    });
    expect(rows).toEqual([
      { userId: 't1', email: 't@x.com' },
      { userId: 'c1', email: 'c@x.com' },
    ]);
    expect(em.find).toHaveBeenCalledTimes(2);
  });

  it('mergeRecipients dedupes across lists', () => {
    expect(
      mergeRecipients(
        [{ userId: 'a', email: 'a@x.com' }],
        [
          { userId: 'a', email: 'a@x.com' },
          { userId: 'b', email: 'b@x.com' },
        ],
      ),
    ).toEqual([
      { userId: 'a', email: 'a@x.com' },
      { userId: 'b', email: 'b@x.com' },
    ]);
  });

  it('engagementClientContactRecipients sets email channel only when receiveEmail', async () => {
    const em = {
      find: jest.fn(async () => [
        {
          receiveEmail: true,
          user: { id: 'main', email: 'main@x.com', isActive: true },
        },
        {
          receiveEmail: false,
          user: { id: 'cc', email: 'cc@x.com', isActive: true },
        },
      ]),
    };
    const rows = await engagementClientContactRecipients(em as never, 'eng-1');
    expect(rows).toEqual([
      {
        userId: 'main',
        email: 'main@x.com',
        channels: { inApp: true, email: true },
      },
      {
        userId: 'cc',
        email: null,
        channels: { inApp: true, email: false },
      },
    ]);
    expect(em.find).toHaveBeenCalledWith(
      EngagementClientContactEntity,
      { engagement: 'eng-1' },
      { populate: ['user'] },
    );
  });
});
