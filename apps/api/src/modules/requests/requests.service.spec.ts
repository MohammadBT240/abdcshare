import { BadRequestException } from '@nestjs/common';
import { RequestsService, REQUEST_EVENT } from './requests.service';
import { RequestEntity } from './infrastructure/persistence/request.entity';
import { RequestHistoryEntity } from './infrastructure/persistence/request-history.entity';
import { RequestStageEntity } from '../request-stages/infrastructure/persistence/request-stage.entity';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { EngagementRequestClassEntity } from '../engagements/infrastructure/persistence/engagement-request-class.entity';
import { RequestTypeEntity } from '../request-types/infrastructure/persistence/request-type.entity';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

// Super Admin ⇒ unscoped (resolveScope → 'all'), so no membership check runs.
const admin = { userId: 'u1', email: '', role: 'Super Admin', mustChangePassword: false } as AuthenticatedUser;

describe('RequestsService', () => {
  describe('create — request-class scope rule', () => {
    it('rejects a request whose type request class is not in the engagement scope', async () => {
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementEntity) return { id: 'eng-1' };
          if (entity === RequestTypeEntity) return { id: 7, name: 'Bank stmt', requestClass: { id: 5, name: 'Cash' } };
          if (entity === EngagementRequestClassEntity) return null; // NOT in scope
          return null;
        }),
        create: jest.fn(),
        count: jest.fn(),
        getReference: jest.fn(),
        persistAndFlush: jest.fn(),
        find: jest.fn(async () => []),
      };
      const service = new RequestsService(em as never, { emit: jest.fn() } as never);
      await expect(
        service.create({ engagementId: 'eng-1', requestTypeId: 7, description: 'Provide it' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(em.create).not.toHaveBeenCalled(); // failed before persisting
    });
  });

  describe('setStage', () => {
    it('sets the new stage and records a StageChanged history row', async () => {
      const request: { stage: { id: number; name: string } } = { stage: { id: 1, name: 'Open' } };
      const newStage = { id: 2, name: 'In Progress' };
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
      const em = {
        // findScoped loads the request; the stage lookup returns the new stage.
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === RequestEntity) return request;
          if (entity === RequestStageEntity) return newStage;
          return null;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          created.push({ entity, data });
          return data;
        }),
        flush: jest.fn(async () => undefined),
      };
      const service = new RequestsService(em as never, { emit: jest.fn() } as never);
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'r1' } as never);

      await service.setStage('r1', { stageId: 2, note: 'moving on' }, admin);

      expect(request.stage).toBe(newStage);
      const history = created.find((c) => c.entity === RequestHistoryEntity)?.data;
      expect(history?.eventType).toBe(REQUEST_EVENT.StageChanged);
      expect(history?.fromValue).toBe('Open');
      expect(history?.toValue).toBe('In Progress');
    });
  });
});
