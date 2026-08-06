import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EVENT } from '@abdcshare/shared';
import { UsersService } from './users.service';

describe('UsersService.resetPassword', () => {
  const activeUser = {
    id: 'u1',
    email: 'jane@x.co',
    isActive: true,
    passwordHash: 'old',
    mustChangePassword: false,
    role: { roleName: 'Staff' },
  };

  function build(overrides: { findOne?: jest.Mock } = {}) {
    const em = {
      findOne: overrides.findOne ?? jest.fn().mockResolvedValue(activeUser),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    const outbox = { enqueue: jest.fn() };
    const tokens = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
    const storage = { presignDownload: jest.fn() };
    const service = new UsersService(em as never, outbox as never, tokens as never, storage as never);
    return { service, em, outbox, tokens };
  }

  it('mints a temp password, forces change, emails credentials, and revokes sessions', async () => {
    const { service, outbox, tokens } = build();
    await service.resetPassword('u1');

    expect(activeUser.mustChangePassword).toBe(true);
    expect(activeUser.passwordHash).not.toBe('old');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      EVENT.UserCreated,
      expect.objectContaining({ userId: 'u1', email: 'jane@x.co', tempPassword: expect.any(String) }),
    );
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('rejects missing users', async () => {
    const { service } = build({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(service.resetPassword('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inactive users', async () => {
    const { service } = build({
      findOne: jest.fn().mockResolvedValue({ ...activeUser, isActive: false }),
    });
    await expect(service.resetPassword('u1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
