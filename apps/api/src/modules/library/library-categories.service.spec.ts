import { ConflictException, NotFoundException } from '@nestjs/common';
import { LibraryCategoriesService } from './library-categories.service';

function buildEm(overrides: Record<string, unknown> = {}) {
  return {
    findOne: jest.fn(async () => null),
    findAndCount: jest.fn(async (..._args: unknown[]) => [[], 0] as [unknown[], number]),
    create: jest.fn((_e: unknown, data: Record<string, unknown>) => ({ id: 'cat-new', ...data })),
    persistAndFlush: jest.fn(),
    flush: jest.fn(),
    ...overrides,
  };
}

describe('LibraryCategoriesService', () => {
  it('derives the slug from the name', async () => {
    const service = new LibraryCategoriesService(buildEm() as never);
    await expect(service.create({ name: 'Tax & Fiscal Policy' })).resolves.toMatchObject({
      name: 'Tax & Fiscal Policy',
      slug: 'tax-fiscal-policy',
      isActive: true,
    });
  });

  it('rejects a duplicate name or slug', async () => {
    const service = new LibraryCategoriesService(buildEm({ findOne: jest.fn(async () => ({ id: 'cat-1' })) }) as never);
    await expect(service.create({ name: 'Reports' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('hides inactive categories unless a manager asks for them', async () => {
    const em = buildEm();
    const service = new LibraryCategoriesService(em as never);
    await service.list({ page: 1, pageSize: 20, includeInactive: true }, false);
    expect(em.findAndCount.mock.calls[0]![1]).toEqual({ isActive: true });
    await service.list({ page: 1, pageSize: 20, includeInactive: true }, true);
    expect(em.findAndCount.mock.calls[1]![1]).toEqual({});
  });

  it('404s when deactivating a missing category', async () => {
    const service = new LibraryCategoriesService(buildEm() as never);
    await expect(service.setActive('nope', false)).rejects.toBeInstanceOf(NotFoundException);
  });
});
