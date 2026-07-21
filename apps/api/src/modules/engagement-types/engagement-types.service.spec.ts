import { NotFoundException } from '@nestjs/common';
import { EngagementTypesService } from './engagement-types.service';

describe('EngagementTypesService.setAllowedRequestClasses', () => {
  const et = { id: 3, name: 'Statutory Audit', isActive: true };

  it('validates, replaces the set, and returns the allowed ids', async () => {
    const find = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'old' }]) // existing links to remove
      .mockResolvedValueOnce([{ requestClass: { id: 2 } }, { requestClass: { id: 1 } }]); // toDto read-back
    const em = {
      findOneOrFail: jest.fn(async () => et),
      count: jest.fn(async () => 2), // both request classes exist
      find,
      remove: jest.fn(),
      create: jest.fn(),
      getReference: jest.fn((_e: unknown, id: number) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new EngagementTypesService(em as never);

    const result = await service.setAllowedRequestClasses(3, [1, 2, 2]);

    expect(em.remove).toHaveBeenCalledTimes(1); // removed the one existing link
    expect(em.create).toHaveBeenCalledTimes(2); // de-duped 2,2 → {1,2}
    expect(result.allowedRequestClassIds).toEqual([1, 2]); // sorted
  });

  it('rejects when a request class does not exist', async () => {
    const em = {
      findOneOrFail: jest.fn(async () => et),
      count: jest.fn(async () => 1), // only 1 of 2 found
      find: jest.fn(async () => []),
      remove: jest.fn(),
      create: jest.fn(),
      getReference: jest.fn(),
      flush: jest.fn(),
    };
    const service = new EngagementTypesService(em as never);
    await expect(service.setAllowedRequestClasses(3, [1, 99])).rejects.toBeInstanceOf(NotFoundException);
  });
});
