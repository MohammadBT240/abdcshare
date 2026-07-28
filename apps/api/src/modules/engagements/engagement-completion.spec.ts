import { BadRequestException } from '@nestjs/common';
import { EngagementStatus } from '@abdcshare/shared';
import { EngagementsService } from './engagements.service';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementRequestClassEntity } from './infrastructure/persistence/engagement-request-class.entity';
import { EngagementSignOffEntity } from './infrastructure/persistence/engagement-sign-off.entity';

describe('EngagementsService.transition → Completed (sign-off gate)', () => {
  it('blocks completion while an in-scope request class is unsigned', async () => {
    const em = {
      findOneOrFail: jest.fn(async () => ({ status: EngagementStatus.Reporting })),
      count: jest.fn(async () => 0), // no engagement-wide sign-off
      find: jest.fn(async (entity: unknown) => {
        if (entity === EngagementRequestClassEntity) return [{ requestClass: { id: 1 } }]; // one class in scope
        if (entity === EngagementSignOffEntity) return []; // none signed off
        return [];
      }),
      create: jest.fn(),
      flush: jest.fn(),
    };
    const service = new EngagementsService(em as never);
    await expect(
      service.transition('e1', { toStatus: EngagementStatus.Completed }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled(); // never wrote the status-history row
  });

  it('allows completion when an engagement-wide sign-off exists', async () => {
    const engagement = { status: EngagementStatus.Reporting, completedAt: null as Date | null };
    const em = {
      findOneOrFail: jest.fn(async (entity: unknown) =>
        entity === EngagementEntity ? engagement : engagement,
      ),
      count: jest.fn(async () => 1), // engagement-wide sign-off present
      find: jest.fn(async () => []),
      create: jest.fn(),
      getReference: jest.fn(),
      flush: jest.fn(async () => undefined),
    };
    const service = new EngagementsService(em as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'e1' } as never);

    await service.transition('e1', { toStatus: EngagementStatus.Completed }, 'u1');
    expect(engagement.status).toBe(EngagementStatus.Completed);
    expect(engagement.completedAt).toBeInstanceOf(Date);
  });
});
