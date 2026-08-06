import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserEntity } from './infrastructure/persistence/user.entity';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

describe('UsersService.assertCanManageAvatar', () => {
  function build(roleName: string) {
    const em = {
      findOne: jest.fn(async () =>
        ({
          id: 'target-1',
          role: { roleName },
        }) as unknown as UserEntity,
      ),
    };
    const service = new UsersService(em as never, {} as never, {} as never, {} as never);
    return { service, em };
  }

  const sa: AuthenticatedUser = {
    userId: 'sa-1',
    email: 'sa@firm.test',
    role: 'Super Admin',
    mustChangePassword: false,
  };

  const platform: AuthenticatedUser = {
    userId: 'pa-1',
    email: 'pa@firm.test',
    role: 'Platform Admin',
    mustChangePassword: false,
  };

  it('allows Platform Admin for any target', async () => {
    const { service } = build('Staff');
    await expect(service.assertCanManageAvatar(platform, 'target-1')).resolves.toBeUndefined();
  });

  it('allows Super Admin for Client contacts', async () => {
    const { service } = build('Client');
    await expect(service.assertCanManageAvatar(sa, 'target-1')).resolves.toBeUndefined();
  });

  it('rejects Super Admin for non-Client users', async () => {
    const { service } = build('Staff');
    await expect(service.assertCanManageAvatar(sa, 'target-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when target is missing', async () => {
    const { service, em } = build('Client');
    em.findOne.mockResolvedValueOnce(null as unknown as UserEntity);
    await expect(service.assertCanManageAvatar(sa, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
