import {
  assigneesOrTeamRecipients,
  engagementTeamRecipients,
  mergeRecipients,
  requestAssigneeRecipients,
} from './recipient-helpers';

describe('recipient-helpers', () => {
  it('engagementTeamRecipients maps team users and dedupes', async () => {
    const em = {
      find: jest.fn(async () => [
        { user: { id: 'u1', email: 'a@x.com' } },
        { user: { id: 'u1', email: 'a@x.com' } },
        { user: { id: 'u2', email: null } },
      ]),
    };
    const rows = await engagementTeamRecipients(em as never, 'eng-1');
    expect(rows).toEqual([
      { userId: 'u1', email: 'a@x.com' },
      { userId: 'u2', email: null },
    ]);
    expect(em.find).toHaveBeenCalled();
  });

  it('requestAssigneeRecipients maps assignees', async () => {
    const em = {
      find: jest.fn(async () => [{ user: { id: 'a1', email: 'a@x.com' } }]),
    };
    await expect(requestAssigneeRecipients(em as never, 'req-1')).resolves.toEqual([
      { userId: 'a1', email: 'a@x.com' },
    ]);
  });

  it('assigneesOrTeamRecipients prefers assignees when present', async () => {
    const em = {
      find: jest
        .fn()
        .mockResolvedValueOnce([{ user: { id: 'a1', email: 'a@x.com' } }]) // assignees
        .mockResolvedValueOnce([{ user: { id: 't1', email: 't@x.com' } }]), // team (unused)
    };
    const rows = await assigneesOrTeamRecipients(em as never, {
      requestId: 'r1',
      engagementId: 'e1',
    });
    expect(rows).toEqual([{ userId: 'a1', email: 'a@x.com' }]);
    expect(em.find).toHaveBeenCalledTimes(1);
  });

  it('assigneesOrTeamRecipients falls back to team when no assignees', async () => {
    const em = {
      find: jest
        .fn()
        .mockResolvedValueOnce([]) // assignees
        .mockResolvedValueOnce([{ user: { id: 't1', email: 't@x.com' } }]),
    };
    const rows = await assigneesOrTeamRecipients(em as never, {
      requestId: 'r1',
      engagementId: 'e1',
    });
    expect(rows).toEqual([{ userId: 't1', email: 't@x.com' }]);
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
});
