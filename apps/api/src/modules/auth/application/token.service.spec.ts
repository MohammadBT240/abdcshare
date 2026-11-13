import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';

describe('TokenService.rotate', () => {
  function build(user: { isActive: boolean }) {
    const row = {
      familyId: 'fam-1',
      revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@x.co', role: { roleName: 'Staff' }, mustChangePassword: false, ...user },
    };
    const em = {
      findOne: jest.fn().mockResolvedValue(row),
      nativeUpdate: jest.fn().mockResolvedValue(1),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TokenService({ signAsync: jest.fn() } as never, { get: jest.fn() } as never, em as never);
    return { service, em, row };
  }

  it('refuses to refresh a deactivated account and ends its session family', async () => {
    const { service, em } = build({ isActive: false });
    await expect(service.rotate('raw-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(em.nativeUpdate).toHaveBeenCalledWith(expect.anything(), { familyId: 'fam-1', revokedAt: null }, { revokedAt: expect.any(Date) });
  });
});
