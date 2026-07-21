import { ConflictException, NotFoundException } from '@nestjs/common';
import { RequestTypesService } from './request-types.service';
import { RequestTypeEntity } from './infrastructure/persistence/request-type.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';

describe('RequestTypesService.create', () => {
  const requestClass = { id: 5, name: 'Cash & Bank' } as RequestClassEntity;

  function buildEm(opts: { requestClass?: unknown; existingType?: unknown } = {}) {
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === RequestClassEntity) return 'requestClass' in opts ? opts.requestClass : requestClass;
        if (entity === RequestTypeEntity) return opts.existingType ?? null;
        return null;
      }),
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => ({ id: 1, ...data })),
      persistAndFlush: jest.fn(async () => undefined),
    };
    return em;
  }

  it('creates a request type under its request class with defaults', async () => {
    const em = buildEm();
    const service = new RequestTypesService(em as never);
    const result = await service.create({ requestClassId: 5, name: 'Bank statement' });
    expect(result.requestClassId).toBe(5);
    expect(result.name).toBe('Bank statement');
    expect(result.expectedDocuments).toBe(1);
    expect(result.isActive).toBe(true);
  });

  it('rejects a duplicate (requestClass, name) pair', async () => {
    const em = buildEm({ existingType: { id: 9 } });
    const service = new RequestTypesService(em as never);
    await expect(service.create({ requestClassId: 5, name: 'Bank statement' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects an unknown request class', async () => {
    const em = buildEm({ requestClass: null });
    const service = new RequestTypesService(em as never);
    await expect(service.create({ requestClassId: 99, name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
