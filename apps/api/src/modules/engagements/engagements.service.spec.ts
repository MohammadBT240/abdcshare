import { BadRequestException } from '@nestjs/common';
import { EngagementMemberRole, EngagementStage } from '@abdcshare/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementsService } from './engagements.service';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementStageHistoryEntity } from './infrastructure/persistence/engagement-status-history.entity';
import { EngagementRequestClassEntity } from './infrastructure/persistence/engagement-request-class.entity';
import { EngagementTeamMemberEntity } from './infrastructure/persistence/engagement-team-member.entity';

const sa = {
  userId: 'u1',
  email: '',
  role: 'Super Admin',
  mustChangePassword: false,
} as AuthenticatedUser;

function mockOutbox() {
  return { enqueue: jest.fn() };
}

function mockNotifications() {
  return { emit: jest.fn(async () => undefined) };
}

describe('EngagementsService', () => {
  describe('create', () => {
    it('generates a sequential reference code and opens in Planning with an initial history row', async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
      const { UserEntity } = await import('../users/infrastructure/persistence/user.entity');
      const em = {
        findOne: jest.fn(async () => ({ id: 1, name: 'X', primaryContact: { id: 'contact-1' } })),
        count: jest.fn(async () => 2), // two engagements already exist this year
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: 'eng-1', ...data };
          created.push({ entity, data: row });
          return row;
        }),
        persistAndFlush: jest.fn(async () => undefined),
        find: jest.fn(async (entity: unknown) => {
          if (entity === UserEntity) {
            return [{ id: 'contact-1', role: { roleName: 'Client' }, isActive: true }];
          }
          return [];
        }),
        flush: jest.fn(async () => undefined),
      };
      const outbox = mockOutbox();
      const notifications = mockNotifications();
      const service = new EngagementsService(em as never, outbox as never, notifications as never, { presignDownload: jest.fn() } as never);
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'eng-1' } as never);

      await service.create(
        {
          clientId: 'c1',
          engagementTypeId: 1,
          departmentId: 1,
          title: 'FY25 Audit',
          clientContactUserIds: ['contact-1'],
          mainClientContactUserId: 'contact-1',
        },
        'user-1',
      );

      const engagement = created.find((c) => c.entity === EngagementEntity)?.data;
      expect(engagement?.referenceCode).toBe(`ENG-${new Date().getFullYear()}-0003`);
      expect(engagement?.stage).toBe(EngagementStage.Planning);

      const history = created.find((c) => c.entity === EngagementStageHistoryEntity)?.data;
      expect(history?.fromStage).toBeNull();
      expect(history?.toStage).toBe(EngagementStage.Planning);
      const lead = created.find((c) => c.entity === EngagementTeamMemberEntity)?.data;
      expect(lead?.memberRole).toBe(EngagementMemberRole.Lead);
      expect(outbox.enqueue).toHaveBeenCalled();
      expect(notifications.emit).toHaveBeenCalled();
    });
  });

  describe('transition', () => {
    function serviceWith(stage: EngagementStage) {
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementEntity) {
            return { id: 'e1', createdBy: { id: sa.userId } };
          }
          return null;
        }),
        findOneOrFail: jest.fn(async () => ({ stage, referenceCode: 'ENG-1' })),
        create: jest.fn(),
        flush: jest.fn(),
        getReference: jest.fn(),
        find: jest.fn(async () => []),
      };
      return new EngagementsService(em as never, mockOutbox() as never, mockNotifications() as never, { presignDownload: jest.fn() } as never);
    }

    it('rejects a disallowed transition (Planning → Completed)', async () => {
      const service = serviceWith(EngagementStage.Planning);
      await expect(
        service.transition('e1', { toStage: EngagementStage.Completed }, sa),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects transitioning to the current stage', async () => {
      const service = serviceWith(EngagementStage.Execution);
      await expect(
        service.transition('e1', { toStage: EngagementStage.Execution }, sa),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('clone', () => {
    it('copies scope, makes cloner Lead (not source team), starts in Planning', async () => {
      const source = {
        id: 'source',
        client: { id: 'c1', primaryContact: { id: 'contact-1' } },
        engagementType: { id: 2 },
        department: { id: 3 },
        title: 'Annual audit FY25',
        periodLabel: 'FY25',
        requestClasses: {
          getItems: () => [
            { requestClass: { id: 8 }, sortOrder: 1 },
          ],
        },
        clientContacts: {
          getItems: () => [
            { user: { id: 'contact-1' }, isMain: true, receiveEmail: true },
          ],
        },
      };
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
      const { UserEntity } = await import('../users/infrastructure/persistence/user.entity');
      const em = {
        findOne: jest.fn(async () => source),
        count: jest.fn(async () => 4),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: 'clone', ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_entity: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
        find: jest.fn(async (entity: unknown) => {
          if (entity === UserEntity) {
            return [{ id: 'contact-1', role: { roleName: 'Client' }, isActive: true }];
          }
          return [];
        }),
        flush: jest.fn(async () => undefined),
      };
      const service = new EngagementsService(em as never, mockOutbox() as never, mockNotifications() as never, { presignDownload: jest.fn() } as never);
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'clone' } as never);

      await service.clone('source', { periodLabel: 'FY26' }, 'u1');

      const clone = created.find((row) => row.entity === EngagementEntity)?.data;
      expect(clone).toEqual(expect.objectContaining({
        referenceCode: `ENG-${new Date().getFullYear()}-0005`,
        periodLabel: 'FY26',
        stage: EngagementStage.Planning,
      }));
      expect(created.filter((row) => row.entity === EngagementRequestClassEntity)).toHaveLength(1);
      const lead = created.find((row) => row.entity === EngagementTeamMemberEntity)?.data;
      expect(lead?.memberRole).toBe(EngagementMemberRole.Lead);
      expect(lead?.user).toEqual({ id: 'u1' });
    });
  });
});
