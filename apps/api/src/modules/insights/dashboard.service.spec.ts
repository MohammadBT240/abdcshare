import { DashboardService } from './dashboard.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { NotificationEntity } from '../notifications/infrastructure/persistence/notification.entity';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { PartnerReportEntity } from '../partner-reports/infrastructure/persistence/partner-report.entity';
import { ActivityLogEntity } from '../audit/infrastructure/persistence/activity-log.entity';
function user(partial: Partial<AuthenticatedUser> & Pick<AuthenticatedUser, 'role'>): AuthenticatedUser {
  return {
    userId: 'u1',
    email: 'u@x.com',
    mustChangePassword: false,
    ...partial,
  };
}

describe('DashboardService.summary', () => {
  it('returns governance for Platform Admin (no engagement queries)', async () => {
    const counted: unknown[] = [];
    const em = {
      count: jest.fn(async (entity: unknown) => {
        counted.push(entity);
        if (entity === NotificationEntity) return 2;
        if (entity === UserEntity) return 3;
        if (entity === ActivityLogEntity) return 5;
        return 1;
      }),
      find: jest.fn(async () => []),
    };
    const partnerReports = {
      dashboard: jest.fn(),
      myReportingStatus: jest.fn(),
    };
    const service = new DashboardService(em as never, partnerReports as never);

    const result = await service.summary(user({ role: 'Platform Admin' }));

    expect(result.kind).toBe('governance');
    if (result.kind !== 'governance') return;
    expect(result.notifications.unread).toBe(2);
    expect(result.audit.last7Days).toBe(5);
    expect(result.catalogue.requestTypes).toBe(1);
    expect(counted).not.toContain(EngagementEntity);
    expect(counted).not.toContain(RequestEntity);
    expect(partnerReports.dashboard).not.toHaveBeenCalled();
  });

  it('returns guest payload without firm engagement counts', async () => {
    const counted: unknown[] = [];
    const em = {
      count: jest.fn(async (entity: unknown) => {
        counted.push(entity);
        if (entity === NotificationEntity) return 0;
        if (entity === PartnerReportEntity) return 1;
        return 0;
      }),
      find: jest.fn(async () => []),
    };
    const partnerReports = {
      dashboard: jest.fn(),
      myReportingStatus: jest.fn(async () => ({
        canSubmit: true,
        cadence: 'Weekly',
        remindersEnabled: true,
        reportRequestedAt: null,
        requestNote: null,
        lastSubmittedAt: null,
        expectation: 'due',
      })),
    };
    const service = new DashboardService(em as never, partnerReports as never);

    const result = await service.summary(user({ role: 'Guest' }));

    expect(result.kind).toBe('guest');
    if (result.kind !== 'guest') return;
    expect(result.reporting.expectation).toBe('due');
    expect(result.reporting.drafts).toBe(1);
    expect(counted).not.toContain(EngagementEntity);
    expect(counted).not.toContain(DocumentEntity);
    expect(partnerReports.dashboard).not.toHaveBeenCalled();
  });

  it('returns firm dashboard for Super Admin with principal partner strip', async () => {
    const em = {
      count: jest.fn(async (entity: unknown) => {
        if (entity === NotificationEntity) return 1;
        if (entity === EngagementEntity) return 4;
        if (entity === RequestEntity) return 10;
        if (entity === DocumentEntity) return 2;
        return 0;
      }),
      find: jest.fn(async (entity: unknown) => {
        if (entity === RequestEntity) {
          const now = new Date();
          return [
            {
              id: 'r1',
              assignees: { length: 0, getItems: () => [] },
              status: { name: 'Open' },
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'r2',
              assignees: {
                length: 1,
                getItems: () => [{ user: { id: 'u9', fullName: 'Ngozi A' } }],
              },
              status: { name: 'Open' },
              createdAt: now,
              updatedAt: now,
            },
          ];
        }
        return [];
      }),
    };
    const partnerReports = {
      dashboard: jest.fn(async () => ({
        total: 9,
        drafts: 1,
        awaitingReview: 3,
        reviewed: 5,
        awaitingDecision: 2,
      })),
      myReportingStatus: jest.fn(),
    };
    const service = new DashboardService(em as never, partnerReports as never);

    const result = await service.summary(
      user({ role: 'Super Admin', partnerDesignation: 'PrincipalPartner' }),
    );

    expect(result.kind).toBe('firm');
    if (result.kind !== 'firm') return;
    expect(result.engagements.total).toBe(4);
    expect(result.requests.unassigned).toBe(1);
    expect(result.partner?.mode).toBe('principal');
    if (result.partner?.mode === 'principal') {
      expect(result.partner.awaitingReview).toBe(3);
    }
    expect(result.attention.some((a) => a.id === 'partner-awaiting-review')).toBe(true);
  });

  it('returns staff dashboard scoped to assigned work', async () => {
    const em = {
      count: jest.fn(async (entity: unknown) => {
        if (entity === NotificationEntity) return 0;
        if (entity === RequestEntity) return 2;
        return 0;
      }),
      find: jest.fn(async (entity: unknown) => {
        if (entity === EngagementEntity) {
          return [{ id: 'e1', title: 'Audit', referenceCode: 'ENG-1', stage: 'Execution' }];
        }
        if (entity === RequestEntity) {
          return [
            {
              id: 'r1',
              dueDate: new Date('2000-01-01'),
              status: { name: 'Open' },
              engagement: { id: 'e1' },
            },
          ];
        }
        return [];
      }),
    };
    const partnerReports = {
      dashboard: jest.fn(),
      myReportingStatus: jest.fn(async () => ({
        canSubmit: false,
        cadence: null,
        remindersEnabled: false,
        reportRequestedAt: null,
        requestNote: null,
        lastSubmittedAt: null,
        expectation: 'ok',
      })),
    };
    const service = new DashboardService(em as never, partnerReports as never);

    const result = await service.summary(user({ role: 'Staff', userId: 'staff-1' }));

    expect(result.kind).toBe('staff');
    if (result.kind !== 'staff') return;
    expect(result.assigned.open).toBe(2);
    expect(result.myEngagements[0]?.referenceCode).toBe('ENG-1');
    expect(result.partner).toBeUndefined();
  });

  it('returns client dashboard with outstanding work', async () => {
    const em = {
      count: jest.fn(async (entity: unknown, where?: Record<string, unknown>) => {
        if (entity === NotificationEntity) return 3;
        if (entity === RequestEntity) return 4;
        if (entity === DocumentEntity) {
          // Regression: client scope must be nested under `engagement`, not
          // spread onto DocumentEntity (clientContacts is not a document field).
          expect(where).not.toHaveProperty('clientContacts');
          expect(where).toHaveProperty('engagement');
          return 1;
        }
        return 2;
      }),
      find: jest.fn(async () => [
        { id: 'e1', title: 'FY26', referenceCode: 'C-1', stage: 'Planning' },
      ]),
    };
    const service = new DashboardService(em as never, {
      dashboard: jest.fn(),
      myReportingStatus: jest.fn(),
    } as never);

    const result = await service.summary(
      user({ role: 'Client', clientId: 'client-1', userId: 'cu1' }),
    );

    expect(result.kind).toBe('client');
    if (result.kind !== 'client') return;
    expect(result.outstandingRequests).toBe(4);
    expect(result.finalReportsAwaitingMe).toBe(1);
    expect(result.recentEngagements).toHaveLength(1);
    expect(result.attention.some((a) => a.id === 'pending-client')).toBe(true);
  });
});
