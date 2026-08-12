import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService password reset', () => {
  const config = { get: (_k: string, d?: unknown) => d } as never;

  it('requestPasswordReset is neutral when the email is unknown (no token, no event)', async () => {
    const em = { findOne: jest.fn(async () => null), create: jest.fn(), flush: jest.fn() };
    const outbox = { enqueue: jest.fn() };
    const service = new AuthService(
      em as never,
      {} as never,
      outbox as never,
      config,
      { record: jest.fn() } as never,
      { presignDownload: jest.fn() } as never,
    );

    await expect(service.requestPasswordReset({ email: 'nobody@x.com' })).resolves.toBeUndefined();
    expect(em.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('resetPassword rejects an invalid/expired token', async () => {
    const em = { findOne: jest.fn(async () => null) };
    const service = new AuthService(
      em as never,
      {} as never,
      { enqueue: jest.fn() } as never,
      config,
      { record: jest.fn() } as never,
      { presignDownload: jest.fn() } as never,
    );
    await expect(
      service.resetPassword({ token: 'bad', newPassword: 'longenough1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
