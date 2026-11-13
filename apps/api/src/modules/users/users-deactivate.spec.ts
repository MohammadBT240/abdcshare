import { UsersService } from './users.service';

describe('UsersService deactivation', () => {
  function build(user: Record<string, unknown>) {
    const em = {
      findOneOrFail: jest.fn().mockResolvedValue(user),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(2),
      flush: jest.fn().mockResolvedValue(undefined),
    };
    const tokens = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(em as never, { enqueue: jest.fn() } as never, tokens as never, { presignDownload: jest.fn() } as never);
    jest.spyOn(service as never, 'toDto' as never).mockReturnValue({} as never);
    return { service, tokens };
  }
  const staff = () => ({ id: 'u1', isActive: true, role: { id: 3, roleName: 'Staff' } });

  it('signs a deactivated user out of every session', async () => {
    const user = staff();
    const { service, tokens } = build(user);
    await service.deactivate('u1');
    expect(user.isActive).toBe(false);
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('leaves sessions alone for other edits', async () => {
    const { service, tokens } = build(staff());
    await service.update('u1', { firstName: 'Jo' } as never);
    expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
  });
});
