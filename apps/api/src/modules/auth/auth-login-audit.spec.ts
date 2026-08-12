import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';

describe('AuthService.login audit', () => {
  const user = {
    id: 'user-1',
    email: 'ada@example.com',
    fullName: 'Ada Lovelace',
    isActive: true,
    passwordHash: '',
    mustChangePassword: false,
    partnerDesignation: null,
    client: null,
    role: { roleName: 'Super Admin' },
    avatarPath: null,
  };

  beforeAll(async () => {
    user.passwordHash = await bcrypt.hash('Secret123!', 4);
  });

  it('records LOGIN on successful authentication', async () => {
    const em = {
      findOne: jest.fn(async (entity: unknown) => (entity === UserEntity ? user : null)),
    };
    const tokens = {
      issuePair: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const storage = { presignDownload: jest.fn().mockResolvedValue(null) };
    const service = new AuthService(
      em as never,
      tokens as never,
      { enqueue: jest.fn() } as never,
      { get: jest.fn() } as never,
      audit as never,
      storage as never,
    );

    await service.login({ email: 'ada@example.com', password: 'Secret123!' }, '203.0.113.10');

    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: 'LOGIN',
      entityType: 'auth',
      entityId: 'user-1',
      ipAddress: '203.0.113.10',
    });
  });

  it('does not record audit on failed login', async () => {
    const em = {
      findOne: jest.fn(async () => user),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const service = new AuthService(
      em as never,
      { issuePair: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      { get: jest.fn() } as never,
      audit as never,
      { presignDownload: jest.fn() } as never,
    );

    await expect(
      service.login({ email: 'ada@example.com', password: 'wrong' }, '1.1.1.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
