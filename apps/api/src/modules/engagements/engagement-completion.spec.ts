import { BadRequestException } from '@nestjs/common';
import { EngagementStage } from '@abdcshare/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementsService } from './engagements.service';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementRequestClassEntity } from './infrastructure/persistence/engagement-request-class.entity';
import { EngagementSignOffEntity } from './infrastructure/persistence/engagement-sign-off.entity';

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

describe('EngagementsService.transition → Completed (sign-off gate)', () => {
  it('blocks completion while an in-scope request class is unsigned', async () => {
    const em = {
      findOne: jest.fn(async () => null),
      findOneOrFail: jest.fn(async () => ({ stage: EngagementStage.Reporting })),
      count: jest.fn(async () => 0), // no engagement-wide sign-off
      find: jest.fn(async (entity: unknown) => {
        if (entity === EngagementRequestClassEntity) return [{ requestClass: { id: 1 } }]; // one class in scope
        if (entity === EngagementSignOffEntity) return []; // none signed off
        return [];
      }),
      create: jest.fn(),
      flush: jest.fn(),
    };
    const service = new EngagementsService(em as never, mockOutbox() as never, mockNotifications() as never);
    await expect(
      service.transition('e1', { toStage: EngagementStage.Completed }, sa),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled(); // never wrote the stage-history row
  });

  it('allows completion when an engagement-wide sign-off exists', async () => {
    const engagement = {
      stage: EngagementStage.Reporting,
      completedAt: null as Date | null,
      referenceCode: 'ENG-1',
    };
    const em = {
      findOne: jest.fn(async () => null),
      findOneOrFail: jest.fn(async (entity: unknown) =>
        entity === EngagementEntity ? engagement : engagement,
      ),
      count: jest.fn(async () => 1), // engagement-wide sign-off present
      find: jest.fn(async () => []),
      create: jest.fn(),
      getReference: jest.fn(),
      flush: jest.fn(async () => undefined),
    };
    const outbox = mockOutbox();
    const notifications = mockNotifications();
    const service = new EngagementsService(em as never, outbox as never, notifications as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'e1' } as never);

    await service.transition('e1', { toStage: EngagementStage.Completed }, sa);
    expect(engagement.stage).toBe(EngagementStage.Completed);
    expect(engagement.completedAt).toBeInstanceOf(Date);
    expect(outbox.enqueue).toHaveBeenCalled();
    expect(notifications.emit).toHaveBeenCalled();
  });
});
