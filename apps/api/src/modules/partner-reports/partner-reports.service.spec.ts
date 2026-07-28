import { EVENT } from '@abdcshare/shared';
import { PartnerReportsService } from './partner-reports.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { PartnerReportInviteEntity } from './infrastructure/persistence/partner-report-invite.entity';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

const pp = {
  userId: 'pp1',
  email: '',
  role: 'Super Admin',
  partnerDesignation: 'PrincipalPartner',
  mustChangePassword: false,
} as AuthenticatedUser;

describe('PartnerReportsService.createInvite', () => {
  it('provisions a Guest user (must change password) + invite + credential email', async () => {
    const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
    const em = {
      findOne: jest.fn(async (entity: unknown) => (entity === RoleEntity ? { id: 5, roleName: 'Guest' } : null)),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        const row = { id: entity === UserEntity ? 'guest-1' : 'inv-1', ...data };
        created.push({ entity, data: row });
        return row;
      }),
      persistAndFlush: jest.fn(async () => undefined),
    };
    const outbox = { enqueue: jest.fn() };
    const service = new PartnerReportsService(em as never, outbox as never, { emit: jest.fn() } as never);

    await service.createInvite({ email: 'Guest@X.com', fullName: 'Ada Bello' }, pp);

    const guest = created.find((c) => c.entity === UserEntity)?.data;
    expect(guest?.role).toEqual({ id: 5, roleName: 'Guest' });
    expect(guest?.mustChangePassword).toBe(true);
    expect(guest?.email).toBe('guest@x.com'); // normalised
    expect(created.some((c) => c.entity === PartnerReportInviteEntity)).toBe(true);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      EVENT.UserCreated,
      expect.objectContaining({ email: 'guest@x.com', tempPassword: expect.any(String) }),
    );
  });

  it('reminds (does not re-provision) when the email already has an account', async () => {
    const em = {
      findOne: jest.fn(async () => ({ id: 'u', email: 'taken@x.com' })),
      create: jest.fn(),
      flush: jest.fn(async () => undefined),
    };
    const outbox = { enqueue: jest.fn() };
    const emit = jest.fn(async () => undefined);
    const service = new PartnerReportsService(em as never, outbox as never, { emit } as never);

    const result = await service.createInvite({ email: 'Taken@x.com', fullName: 'X Y' }, pp);

    expect(result.outcome).toBe('reminded');
    expect(result.userId).toBe('u');
    expect(em.create).not.toHaveBeenCalled(); // no new Guest / invite
    expect(outbox.enqueue).not.toHaveBeenCalled(); // no credential email
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'partner-report.reminder', excludeUserId: 'pp1' }),
    );
  });
});
