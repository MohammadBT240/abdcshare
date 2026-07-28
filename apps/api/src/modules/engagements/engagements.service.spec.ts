import { BadRequestException } from '@nestjs/common';
import { EngagementStatus } from '@abdcshare/shared';
import { EngagementsService } from './engagements.service';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementStatusHistoryEntity } from './infrastructure/persistence/engagement-status-history.entity';

describe('EngagementsService', () => {
  describe('create', () => {
    it('generates a sequential reference code and opens in Planning with an initial history row', async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
      const em = {
        findOne: jest.fn(async () => ({ id: 1, name: 'X' })), // client/type/department all resolve
        count: jest.fn(async () => 2), // two engagements already exist this year
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: 'eng-1', ...data };
          created.push({ entity, data: row });
          return row;
        }),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const service = new EngagementsService(em as never);
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'eng-1' } as never);

      await service.create(
        { clientId: 'c1', engagementTypeId: 1, departmentId: 1, title: 'FY25 Audit' },
        'user-1',
      );

      const engagement = created.find((c) => c.entity === EngagementEntity)?.data;
      expect(engagement?.referenceCode).toBe(`ENG-${new Date().getFullYear()}-0003`);
      expect(engagement?.status).toBe(EngagementStatus.Planning);

      const history = created.find((c) => c.entity === EngagementStatusHistoryEntity)?.data;
      expect(history?.fromStatus).toBeNull();
      expect(history?.toStatus).toBe(EngagementStatus.Planning);
    });
  });

  describe('transition', () => {
    function serviceWith(status: EngagementStatus) {
      const em = {
        findOneOrFail: jest.fn(async () => ({ status })),
        create: jest.fn(),
        flush: jest.fn(),
        getReference: jest.fn(),
      };
      return new EngagementsService(em as never);
    }

    it('rejects a disallowed transition (Planning → Completed)', async () => {
      const service = serviceWith(EngagementStatus.Planning);
      await expect(
        service.transition('e1', { toStatus: EngagementStatus.Completed }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects transitioning to the current status', async () => {
      const service = serviceWith(EngagementStatus.Execution);
      await expect(
        service.transition('e1', { toStatus: EngagementStatus.Execution }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
