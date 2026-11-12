import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LibraryItemStatus, LibraryReportOutcome, LibraryReportReason, LibraryReportStatus, LibraryVisibility } from '@abdcshare/shared';
import { LibraryReportsService, curatorRoleNames } from './library-reports.service';
import { LibraryReportEntity } from './infrastructure/persistence/library-report.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type { LibraryViewer } from './library-access';

const staff: LibraryViewer = { userId: 'u-staff', departmentId: 2, isCurator: false };
const curator: LibraryViewer = { userId: 'u-sa', departmentId: null, isCurator: true };

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    title: 'Client X working file',
    status: LibraryItemStatus.Published,
    visibility: LibraryVisibility.Firm,
    uploadedBy: { id: 'u-up', fullName: 'Uploader' },
    departments: { getItems: () => [] },
    ...overrides,
  };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r-1',
    item: item(),
    itemTitle: 'Client X working file',
    reporter: { id: 'u-staff', fullName: 'Amina', email: 'amina@e2e.test' },
    reason: LibraryReportReason.ClientConfidential,
    note: null,
    status: LibraryReportStatus.Open,
    createdAt: new Date(),
    ...overrides,
  };
}

function setup(opts: { existing?: unknown; open?: ReturnType<typeof report>[]; item?: ReturnType<typeof item> } = {}) {
  const the = opts.item ?? item();
  const open = opts.open ?? [report({ item: the })];
  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === LibraryReportEntity && 'reporter' in where) return opts.existing ?? null;
      if (entity === LibraryReportEntity) return open.find((r) => r.id === where.id) ?? null;
      return null;
    }),
    findOneOrFail: jest.fn(async () => open[0]),
    find: jest.fn(async (entity: unknown) => {
      if (entity === UserEntity) return [{ id: 'u-sa', email: 'sa@e2e.test' }, { id: 'u-pa', email: 'pa@e2e.test' }];
      if (entity === LibraryReportEntity) return open;
      return [];
    }),
    create: jest.fn((_e: unknown, d: Record<string, unknown>) => ({ id: 'r-new', createdAt: new Date(), status: 'Open', ...d })),
    persist: jest.fn(),
    flush: jest.fn(async () => undefined),
    populate: jest.fn(async (r: Record<string, unknown>) => {
      r.reporter = { id: 'u-staff', fullName: 'Amina' };
    }),
    getReference: jest.fn((_e: unknown, id: string) => ({ id })),
    execute: jest.fn(async () => [{ n: 3 }]),
  };
  const library = {
    loadVisible: jest.fn(async () => the),
    loadItem: jest.fn(async () => the),
    restrictTo: jest.fn(async () => undefined),
    stageArchive: jest.fn(),
    remove: jest.fn(async () => undefined),
  };
  const events = { stage: jest.fn((..._a: unknown[]) => undefined as unknown) };
  const notifications = { emit: jest.fn(async (..._a: unknown[]) => undefined) };
  const service = new LibraryReportsService(em as never, library as never, events as never, notifications as never);
  return { service, em, library, events, notifications, open };
}

describe('LibraryReportsService', () => {
  it('derives curator roles from permissions', () => {
    expect(curatorRoleNames().sort()).toEqual(['Platform Admin', 'Super Admin']);
  });

  it('lets any viewer report a visible item; curators are notified and the item stays visible', async () => {
    const { service, library, notifications, events } = setup();
    const r = await service.create('item-1', { reason: LibraryReportReason.ClientConfidential, note: ' names a client ' }, staff);
    expect(library.loadVisible).toHaveBeenCalledWith('item-1', staff);
    expect(r).toMatchObject({ reason: 'ClientConfidential', note: 'names a client', status: 'Open' });
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'library.reported',
        link: '/library/review',
        excludeUserId: 'u-staff',
        recipients: [
          { userId: 'u-sa', email: 'sa@e2e.test' },
          { userId: 'u-pa', email: 'pa@e2e.test' },
        ],
      }),
    );
    expect(events.stage).toHaveBeenCalledWith(expect.objectContaining({ action: 'Reported', itemId: 'item-1' }));
    expect(library.stageArchive).not.toHaveBeenCalled();
  });

  it('rejects a second open report from the same person', async () => {
    const { service } = setup({ existing: report() });
    await expect(service.create('item-1', { reason: LibraryReportReason.Other }, staff)).rejects.toBeInstanceOf(ConflictException);
  });

  it('only curators list and resolve', async () => {
    const { service } = setup();
    await expect(service.list({ page: 1, pageSize: 20 }, staff)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.resolve('r-1', { outcome: LibraryReportOutcome.Dismiss }, staff)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.count(staff)).resolves.toEqual({ open: 0 });
    await expect(service.count(curator)).resolves.toEqual({ open: 3 });
  });

  it('Dismiss closes every open report on the item and tells each reporter', async () => {
    const the = item();
    const open = [report({ item: the }), report({ id: 'r-2', item: the, reporter: { id: 'u-b', fullName: 'B', email: 'b@e2e.test' } })];
    const { service, notifications, library, events } = setup({ item: the, open });
    await expect(service.resolve('r-1', { outcome: LibraryReportOutcome.Dismiss, note: 'Not client data' }, curator)).resolves.toEqual({
      resolved: 2,
      outcome: 'Dismiss',
    });
    expect(open.map((r) => r.status)).toEqual(['Dismissed', 'Dismissed']);
    expect(library.restrictTo).not.toHaveBeenCalled();
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'library.report_resolved',
        recipients: [
          { userId: 'u-staff', email: 'amina@e2e.test' },
          { userId: 'u-b', email: 'b@e2e.test' },
        ],
        link: '/library/item-1',
      }),
    );
    expect(events.stage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ReportResolved', metadata: expect.objectContaining({ reportIds: ['r-1', 'r-2'] }) }),
    );
  });

  it('Restrict needs departments and applies them', async () => {
    const { service, library, open } = setup();
    await expect(service.resolve('r-1', { outcome: LibraryReportOutcome.Restrict }, curator)).rejects.toBeInstanceOf(BadRequestException);
    await service.resolve('r-1', { outcome: LibraryReportOutcome.Restrict, departmentIds: [3] }, curator);
    expect(library.restrictTo).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }), [3], curator);
    expect(open[0]!.status).toBe('Actioned');
  });

  it('Archive archives the item', async () => {
    const { service, library } = setup();
    await service.resolve('r-1', { outcome: LibraryReportOutcome.Archive }, curator);
    expect(library.stageArchive).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }), curator, 'report');
    expect(library.remove).not.toHaveBeenCalled();
  });

  it('Delete archives, notifies, flushes, then deletes', async () => {
    const { service, library, em, notifications } = setup();
    const order: string[] = [];
    notifications.emit.mockImplementation(async () => void order.push('notify'));
    em.flush.mockImplementation(async () => void order.push('flush'));
    library.remove.mockImplementation(async () => void order.push('remove'));
    await service.resolve('r-1', { outcome: LibraryReportOutcome.Delete }, curator);
    expect(library.stageArchive).toHaveBeenCalled();
    expect(order).toEqual(['notify', 'flush', 'remove']);
    expect(notifications.emit).toHaveBeenCalledWith(expect.objectContaining({ link: '/library' }));
  });

  it('refuses to resolve an already-resolved report', async () => {
    const { service } = setup({ open: [report({ status: LibraryReportStatus.Dismissed })] });
    await expect(service.resolve('r-1', { outcome: LibraryReportOutcome.Dismiss }, curator)).rejects.toBeInstanceOf(ConflictException);
  });
});
