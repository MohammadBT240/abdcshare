import { ForbiddenException } from '@nestjs/common';
import { engagementScopeWhere, resolveScope } from './access-scope';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';

const u = (over: Partial<AuthenticatedUser>): AuthenticatedUser =>
  ({ userId: 'u1', email: '', role: 'Staff', mustChangePassword: false, ...over }) as AuthenticatedUser;

describe('resolveScope', () => {
  it('gives Platform/Super Admin (and internal calls) unrestricted scope', () => {
    expect(resolveScope(u({ role: 'Super Admin' }))).toEqual({ kind: 'all' });
    expect(resolveScope(u({ role: 'Platform Admin' }))).toEqual({ kind: 'all' });
    expect(resolveScope(undefined)).toEqual({ kind: 'all' });
  });

  it('scopes a Client to its org + user id (membership filter)', () => {
    expect(resolveScope(u({ role: 'Client', clientId: 'c9', userId: 'u9' }))).toEqual({
      kind: 'client',
      clientId: 'c9',
      userId: 'u9',
    });
  });

  it('scopes a Staff to itself (team membership)', () => {
    expect(resolveScope(u({ role: 'Staff', userId: 's3' }))).toEqual({ kind: 'staff', userId: 's3' });
  });

  it('forbids a Client with no client link', () => {
    expect(() => resolveScope(u({ role: 'Client', clientId: null }))).toThrow(ForbiddenException);
  });
});

describe('engagementScopeWhere', () => {
  it('maps each scope to the right engagement filter', () => {
    expect(engagementScopeWhere({ kind: 'all' })).toEqual({});
    expect(engagementScopeWhere({ kind: 'client', clientId: 'c1', userId: 'u1' })).toEqual({
      clientContacts: { user: 'u1' },
    });
    expect(engagementScopeWhere({ kind: 'staff', userId: 's1' })).toEqual({ team: { user: 's1' } });
  });
});
