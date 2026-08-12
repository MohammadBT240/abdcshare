import { AuditService } from './audit.service';
import { ActivityLogEntity } from './infrastructure/persistence/activity-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';

describe('AuditService', () => {
  function buildEm(rows: Array<Record<string, unknown>> = []) {
    const em = {
      findAndCount: jest.fn(async () => [rows, rows.length]),
      find: jest.fn(async () => rows),
      fork: jest.fn(),
      create: jest.fn(),
      flush: jest.fn(),
      getReference: jest.fn((entity: unknown, id: unknown) => ({ __ref: entity, id })),
    };
    em.fork.mockReturnValue(em);
    return em;
  }

  function sampleRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'log-1',
      actor: { id: 'user-1', fullName: 'Ada Lovelace', email: 'ada@example.com' },
      action: 'POST /users',
      entityType: 'users',
      entityId: 'user-2',
      ipAddress: '127.0.0.1',
      metadata: { params: { id: 'user-2' } },
      createdAt: new Date('2026-08-10T12:00:00.000Z'),
      ...overrides,
    };
  }

  it('lists with actor display fields and date filters', async () => {
    const rows = [sampleRow()];
    const em = buildEm(rows);
    const service = new AuditService(em as never);

    const result = await service.list({
      page: 1,
      pageSize: 20,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      entityType: 'users',
    });

    expect(em.findAndCount).toHaveBeenCalledWith(
      ActivityLogEntity,
      expect.objectContaining({
        entityType: 'users',
        createdAt: {
          $gte: new Date('2026-08-01T00:00:00.000Z'),
          $lte: new Date('2026-08-31T23:59:59.999Z'),
        },
      }),
      expect.objectContaining({ populate: ['actor'], limit: 20, offset: 0 }),
    );
    expect(result.data[0]).toMatchObject({
      actorId: 'user-1',
      actorName: 'Ada Lovelace',
      actorEmail: 'ada@example.com',
      action: 'POST /users',
    });
    expect(result.meta.total).toBe(1);
  });

  it('applies free-text search across action, entity, ip, and actor', async () => {
    const em = buildEm([sampleRow()]);
    const service = new AuditService(em as never);

    await service.list({ page: 1, pageSize: 20, q: 'users' });

    expect(em.findAndCount).toHaveBeenCalledWith(
      ActivityLogEntity,
      expect.objectContaining({
        $or: expect.arrayContaining([
          { action: { $ilike: '%users%' } },
          { entityType: { $ilike: '%users%' } },
          { ipAddress: { $ilike: '%users%' } },
          { actor: { fullName: { $ilike: '%users%' } } },
          { actor: { email: { $ilike: '%users%' } } },
        ]),
      }),
      expect.any(Object),
    );
  });

  it('exports CSV with header and capped rows', async () => {
    const em = buildEm([sampleRow({ actor: null, actorId: null })]);
    // sampleRow already sets actor; override properly
    em.find.mockResolvedValue([
      sampleRow({
        actor: null,
        action: 'LOGIN',
        entityType: 'auth',
        entityId: 'user-1',
        metadata: null,
      }),
    ]);
    const service = new AuditService(em as never);

    const csv = await service.exportCsv({ page: 1, pageSize: 20, actorId: 'user-1' });

    expect(em.find).toHaveBeenCalledWith(
      ActivityLogEntity,
      expect.objectContaining({ actor: 'user-1' }),
      expect.objectContaining({ limit: 10_000 }),
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'createdAt,actorName,actorEmail,action,entityType,entityId,ipAddress,metadata',
    );
    expect(lines[1]).toContain('LOGIN');
    expect(lines[1]).toContain('auth');
  });

  it('record writes via forked EM and never throws', async () => {
    const em = buildEm();
    const service = new AuditService(em as never);
    await service.record({
      actorId: 'user-1',
      action: 'LOGIN',
      entityType: 'auth',
      entityId: 'user-1',
      ipAddress: '10.0.0.1',
    });
    expect(em.fork).toHaveBeenCalled();
    expect(em.create).toHaveBeenCalledWith(
      ActivityLogEntity,
      expect.objectContaining({
        action: 'LOGIN',
        entityType: 'auth',
        actor: expect.objectContaining({ id: 'user-1' }),
      }),
    );
    expect(em.getReference).toHaveBeenCalledWith(UserEntity, 'user-1');
  });
});
