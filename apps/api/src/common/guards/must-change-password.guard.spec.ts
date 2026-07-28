import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MustChangePasswordGuard } from './must-change-password.guard';

function ctx(user: unknown, path: string): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user, route: { path }, url: path }) }),
  } as unknown as ExecutionContext;
}

describe('MustChangePasswordGuard', () => {
  const reflector = { getAllAndOverride: () => false } as never;
  const guard = new MustChangePasswordGuard(reflector);

  it('blocks a normal route when the user must change their password', () => {
    const user = { userId: 'u1', mustChangePassword: true };
    expect(() => guard.canActivate(ctx(user, '/api/partner-reports'))).toThrow(ForbiddenException);
  });

  it('allows the change-password route through', () => {
    const user = { userId: 'u1', mustChangePassword: true };
    expect(guard.canActivate(ctx(user, '/api/auth/change-password'))).toBe(true);
  });

  it('allows everything once the flag is clear', () => {
    const user = { userId: 'u1', mustChangePassword: false };
    expect(guard.canActivate(ctx(user, '/api/partner-reports'))).toBe(true);
  });
});
