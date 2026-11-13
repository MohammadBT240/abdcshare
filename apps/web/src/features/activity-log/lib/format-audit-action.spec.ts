import { formatAuditAction, truncateId } from './format-audit-action';

describe('formatAuditAction', () => {
  it.each([
    ['LOGIN', 'Signed in'],
    ['POST /api/users', 'Created Users'],
    ['PATCH /api/users/:id', 'Updated Users'],
    ['DELETE /api/documents/:id', 'Deleted Documents'],
    ['POST /api/users/:id/reset-password', 'Users › Reset password'],
    ['POST /api/clients/:id/contacts', 'Clients › Contacts'],
    ['PATCH /api/clients/:id/contacts/:userId', 'Updated Clients › Contacts'],
    ['POST /api/engagements/:id/transition', 'Engagements › Transition'],
    ['POST /api/help/articles', 'Created Help Articles'],
    ['PUT /api/help/articles/:slug/feedback', 'Updated Help Articles › Feedback'],
    ['GET /api/users', 'GET /api/users'],
  ])('%s → %s', (action, label) => {
    expect(formatAuditAction(action)).toBe(label);
  });

  it('truncates long ids', () => {
    expect(truncateId('f4dd3cbb-93ff-44d6-87c1-f6b13d6815c0')).toBe('f4dd3cbb…3d6815c0');
  });
});
