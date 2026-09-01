import { ConflictException, NotFoundException } from '@nestjs/common';
import { HelpService } from './help.service';

function buildEm(overrides: Partial<Record<string, unknown>> = {}) {
  const em = {
    findOne: jest.fn(async () => null),
    findOneOrFail: jest.fn(),
    find: jest.fn(async () => []),
    findAndCount: jest.fn(async () => [[], 0]),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    persistAndFlush: jest.fn(),
    flush: jest.fn(),
    removeAndFlush: jest.fn(),
    getReference: jest.fn((entity: unknown, id: unknown) => ({ __ref: entity, id })),
    ...overrides,
  };
  return em;
}

describe('HelpService categories', () => {
  it('creates a category', async () => {
    const em = buildEm();
    const service = new HelpService(em as never);

    const result = await service.createCategory({ name: 'Engagements', slug: 'engagements', order: 1 });

    expect(em.persistAndFlush).toHaveBeenCalled();
    expect(result).toMatchObject({ name: 'Engagements', slug: 'engagements', order: 1 });
  });

  it('rejects a duplicate slug on create', async () => {
    const em = buildEm({ findOne: jest.fn(async () => ({ id: 'cat-1' })) });
    const service = new HelpService(em as never);

    await expect(
      service.createCategory({ name: 'Engagements', slug: 'engagements' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException updating a missing category', async () => {
    const em = buildEm({
      findOneOrFail: jest.fn(async () => {
        throw new NotFoundException('Help category not found');
      }),
    });
    const service = new HelpService(em as never);

    await expect(service.updateCategory('missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
