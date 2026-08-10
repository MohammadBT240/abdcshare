import { EVENT } from '@abdcshare/shared';
import { PartnerReportsService } from './partner-reports.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { PartnerReportInviteEntity } from './infrastructure/persistence/partner-report-invite.entity';
import { PartnerReportReporterEntity } from './infrastructure/persistence/partner-report-reporter.entity';
import { PartnerReportEntity } from './infrastructure/persistence/partner-report.entity';
import { PartnerReportBillingItemEntity } from './infrastructure/persistence/partner-report-billing-item.entity';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import type { SaveReportDto } from './presentation/dto/partner-report.dto';
import { BadRequestException } from '@nestjs/common';

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
        const row = {
          id:
            entity === UserEntity
              ? 'guest-1'
              : entity === PartnerReportInviteEntity
                ? 'inv-1'
                : 'roster-1',
          ...data,
        };
        created.push({ entity, data: row });
        return row;
      }),
      persist: jest.fn(),
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
    expect(created.some((c) => c.entity === PartnerReportReporterEntity)).toBe(true);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      EVENT.UserCreated,
      expect.objectContaining({ email: 'guest@x.com', tempPassword: expect.any(String) }),
    );
  });

  it('allows Staff (upsert allow-list) and reminds them', async () => {
    const staff = {
      id: 'staff-1',
      email: 'staff@x.com',
      role: { roleName: 'Staff' },
      partnerDesignation: null,
    };
    const created: unknown[] = [];
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === UserEntity) return staff;
        if (entity === PartnerReportReporterEntity) return null;
        return null;
      }),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        created.push(entity);
        return { ...data };
      }),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
    };
    const emit = jest.fn(async () => undefined);
    const service = new PartnerReportsService(em as never, { enqueue: jest.fn() } as never, { emit } as never);

    const result = await service.createInvite({ email: 'Staff@X.com', fullName: 'Sam Staff' }, pp);

    expect(result.outcome).toBe('allowed');
    expect(result.userId).toBe('staff-1');
    expect(created).toContain(PartnerReportReporterEntity);
    expect(em.persist).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'partner-report.reminder', excludeUserId: 'pp1' }),
    );
  });

  it('reminds and upserts roster when the email is an existing Partner', async () => {
    const partner = {
      id: 'u-partner',
      email: 'partner@x.com',
      role: { roleName: 'Super Admin' },
      partnerDesignation: 'Partner',
    };
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === UserEntity) return partner;
        if (entity === PartnerReportReporterEntity) return null;
        return partner;
      }),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => ({ ...data })),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
    };
    const outbox = { enqueue: jest.fn() };
    const emit = jest.fn(async () => undefined);
    const service = new PartnerReportsService(em as never, outbox as never, { emit } as never);

    const result = await service.createInvite({ email: 'Partner@x.com', fullName: 'Pat Partner' }, pp);

    expect(result.outcome).toBe('reminded');
    expect(result.userId).toBe('u-partner');
    expect(em.create).toHaveBeenCalledWith(
      PartnerReportReporterEntity,
      expect.objectContaining({ user: partner }),
    );
    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'partner-report.reminder', excludeUserId: 'pp1' }),
    );
  });

  it('allows Client (upsert allow-list) and reminds them', async () => {
    const client = {
      id: 'u-client',
      email: 'client@x.com',
      role: { roleName: 'Client' },
      partnerDesignation: null,
    };
    const created: unknown[] = [];
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === UserEntity) return client;
        if (entity === PartnerReportReporterEntity) return null;
        return null;
      }),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        created.push(entity);
        return { ...data };
      }),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
    };
    const emit = jest.fn(async () => undefined);
    const service = new PartnerReportsService(em as never, { enqueue: jest.fn() } as never, {
      emit,
    } as never);

    const result = await service.createInvite({ email: 'client@x.com', fullName: 'C Client' }, pp);

    expect(result.outcome).toBe('allowed');
    expect(result.userId).toBe('u-client');
    expect(created).toContain(PartnerReportReporterEntity);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'partner-report.reminder', excludeUserId: 'pp1' }),
    );
  });

  it('stores financialsEnabled on invite prefs', async () => {
    const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
    const em = {
      findOne: jest.fn(async (entity: unknown) => (entity === RoleEntity ? { id: 5, roleName: 'Guest' } : null)),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        const row = { id: 'x', ...data };
        created.push({ entity, data: row });
        return row;
      }),
      persist: jest.fn(),
      persistAndFlush: jest.fn(async () => undefined),
    };
    const service = new PartnerReportsService(em as never, { enqueue: jest.fn() } as never, {
      emit: jest.fn(),
    } as never);

    await service.createInvite(
      { email: 'g@x.com', fullName: 'Guest', financialsEnabled: false },
      pp,
    );

    const roster = created.find((c) => c.entity === PartnerReportReporterEntity)?.data;
    expect(roster?.financialsEnabled).toBe(false);
  });
});

describe('PartnerReportsService.create billings / financials gate', () => {
  const author = {
    userId: 'u1',
    email: 'a@x.com',
    role: 'Super Admin',
    partnerDesignation: 'Partner',
    mustChangePassword: false,
  } as AuthenticatedUser;

  const baseDto = {
    reportingOfficerName: 'Ada',
    department: 'Audit',
    periodType: 'Weekly',
    billingItems: [
      { description: 'Audit fees', amount: '100.00', amountReceived: '40.00' },
      { description: 'Advisory', amount: '50.50', amountReceived: '50.50' },
    ],
  } as SaveReportDto;

  function mockEm(roster: { financialsEnabled: boolean } | null) {
    let report: Record<string, unknown> | null = null;
    const createdBilling: Record<string, unknown>[] = [];
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === PartnerReportReporterEntity) return roster;
        if (entity === PartnerReportInviteEntity) return null;
        if (entity === PartnerReportEntity) return report;
        return null;
      }),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        if (entity === PartnerReportEntity) {
          report = {
            id: 'r1',
            ...data,
            submittedBy: { id: author.userId, fullName: 'Ada', email: 'a@x.com' },
            invite: null,
            feeRevenue: null,
            billingItems: {
              getItems: () =>
                createdBilling.map((b, i) => ({
                  ...b,
                  sortOrder: i,
                })),
            },
            engagementUpdates: { getItems: () => [] },
            decisions: { getItems: () => [] },
            createdAt: new Date(),
            status: 'Draft',
          };
          return report;
        }
        if (entity === PartnerReportBillingItemEntity) {
          createdBilling.push(data);
          return { ...data };
        }
        return { ...data };
      }),
      persistAndFlush: jest.fn(async () => undefined),
      nativeDelete: jest.fn(async () => undefined),
    };
    return { em, getReport: () => report, createdBilling };
  }

  it('rejects financial payload when financialsEnabled is false', async () => {
    const { em } = mockEm({ financialsEnabled: false });
    const service = new PartnerReportsService(em as never, { enqueue: jest.fn() } as never, {
      emit: jest.fn(),
    } as never);

    await expect(service.create(baseDto, author)).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalledWith(PartnerReportEntity, expect.anything());
  });

  it('computes fee revenue, collections and outstanding from billing lines', async () => {
    const { em, getReport, createdBilling } = mockEm({ financialsEnabled: true });
    const service = new PartnerReportsService(em as never, { enqueue: jest.fn() } as never, {
      emit: jest.fn(),
    } as never);

    const dto = await service.create(baseDto, author);

    expect(createdBilling).toHaveLength(2);
    expect(getReport()?.feeRevenue).toBe('150.50');
    expect(getReport()?.collectionsReceived).toBe('90.50');
    expect(getReport()?.outstanding).toBe('60.00');
    expect(dto.feeRevenue).toBe('150.50');
    expect(dto.collectionsReceived).toBe('90.50');
    expect(dto.outstanding).toBe('60.00');
    expect(dto.billingItems).toEqual([
      { description: 'Audit fees', amount: '100.00', amountReceived: '40.00' },
      { description: 'Advisory', amount: '50.50', amountReceived: '50.50' },
    ]);
  });
});
