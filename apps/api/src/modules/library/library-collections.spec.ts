import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EVENT, LibraryItemStatus, LibraryVisibility } from '@abdcshare/shared';
import { canEditCollection, canSeeCollection, collectionScopeSql, type LibraryViewer } from './library-access';
import { LibraryCollectionsService } from './library-collections.service';
import { LibraryCollectionEntity } from './infrastructure/persistence/library-collection.entity';
import { LibraryCollectionItemEntity } from './infrastructure/persistence/library-collection-item.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';

const tax: LibraryViewer = { userId: 'u-tax', departmentId: 2, isCurator: false };
const audit: LibraryViewer = { userId: 'u-audit', departmentId: 1, isCurator: false };
const curator: LibraryViewer = { userId: 'u-sa', departmentId: null, isCurator: true };

describe('collection visibility (mirrors items, D9)', () => {
  const restricted = { status: 'Active' as const, visibility: LibraryVisibility.Departments, ownerId: 'u-x', departmentIds: [2] };
  it.each([
    ['department match', restricted, tax, true],
    ['department mismatch', restricted, audit, false],
    ['curator', restricted, curator, true],
    ['owner of an archived one', { ...restricted, status: 'Archived' as const, ownerId: 'u-audit' }, audit, true],
    ['archived, not owner', { ...restricted, status: 'Archived' as const, visibility: LibraryVisibility.Firm }, tax, false],
  ])('%s', (_l, c, v, expected) => expect(canSeeCollection(c, v)).toBe(expected));

  it('only owners and curators edit', () => {
    expect(canEditCollection({ ownerId: 'u-tax' }, tax)).toBe(true);
    expect(canEditCollection({ ownerId: 'u-tax' }, audit)).toBe(false);
    expect(canEditCollection({ ownerId: 'u-tax' }, curator)).toBe(true);
  });

  it('scope SQL checks firm, owner and department membership', () => {
    const s = collectionScopeSql('c', tax);
    expect(s.sql).toContain(`c.visibility = 'Firm'`);
    expect(s.sql).toContain('lcd.collection_id = c.id and lcd.department_id = ?');
    expect(s.params).toEqual(['u-tax', 2]);
  });
});

function coll(overrides: Record<string, unknown> = {}) {
  const deps: { id: number; name: string }[] = [];
  return {
    id: 'col-1',
    title: 'IFRS training',
    slug: 'ifrs-training',
    type: 'Training',
    visibility: LibraryVisibility.Firm,
    departments: { isInitialized: () => true, getItems: () => deps, removeAll: jest.fn(), set: jest.fn() },
    status: 'Active',
    owner: { id: 'u-tax', fullName: 'Tunde Tax' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(opts: { collection?: unknown; members?: { item: { id: string }; position: number; section?: string | null }[]; rows?: unknown[] } = {}) {
  const execute = jest.fn(async (sql: string) => {
    if (sql.includes('count(*) filter')) return [{ collection_id: 'col-1', visible: 1, total: 3 }];
    return opts.rows ?? [];
  });
  const em = {
    findOne: jest.fn(async (entity: unknown) => (entity === LibraryCollectionEntity ? (opts.collection === undefined ? coll() : opts.collection) : null)),
    find: jest.fn(async (entity: unknown): Promise<unknown[]> => (entity === LibraryCollectionItemEntity ? opts.members ?? [] : [])),
    nativeDelete: jest.fn(async () => 1),
    removeAndFlush: jest.fn(),
    persistAndFlush: jest.fn(),
    flush: jest.fn(),
    create: jest.fn((_e: unknown, d: Record<string, unknown>) => ({ ...coll(), ...d })),
    getReference: jest.fn((_e: unknown, id: string) => ({ id })),
    getConnection: jest.fn(() => ({ execute })),
  };
  const library = { editableCollection: jest.fn(), appendToCollection: jest.fn(async () => 1), toDtos: jest.fn(async () => []) };
  const outbox = { enqueue: jest.fn() };
  const storage = { presignDownload: jest.fn(async () => 'https://r2/x.zip') };
  const service = new LibraryCollectionsService(em as never, library as never, outbox as never, storage as never);
  return { service, em, library, outbox, execute, storage };
}

describe('LibraryCollectionsService', () => {
  it('reports visible and hidden item counts', async () => {
    const { service } = setup();
    await expect(service.get('col-1', tax)).resolves.toMatchObject({ itemCount: 1, hiddenItemCount: 2, canEdit: true });
  });

  it('hides a restricted collection from other departments (404)', async () => {
    const { service } = setup({ collection: coll({ visibility: LibraryVisibility.Departments, owner: { id: 'u-x', fullName: 'X' } }) });
    await expect(service.get('col-1', audit)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("forbids editing someone else's collection", async () => {
    const { service } = setup();
    await expect(service.update('col-1', { title: 'Mine' }, audit)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects non-https links and end dates before start dates', async () => {
    const { service } = setup();
    await expect(service.create({ title: 'T', type: 'Training' as never, externalUrl: 'http://x.test' }, tax)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ title: 'T', type: 'Training' as never, startsOn: '2026-03-12', endsOn: '2026-03-10' }, tax),
    ).rejects.toThrow('End date is before the start date');
  });

  it('deletes only archived collections, and never their items', async () => {
    const active = setup();
    await expect(active.service.remove('col-1', tax)).rejects.toBeInstanceOf(ConflictException);
    const archived = setup({ collection: coll({ status: 'Archived' }) });
    await archived.service.remove('col-1', tax);
    expect(archived.em.nativeDelete).toHaveBeenCalledWith(LibraryCollectionItemEntity, { collection: 'col-1' });
    expect(archived.em.removeAndFlush).toHaveBeenCalled();
    expect(archived.em.nativeDelete).not.toHaveBeenCalledWith(LibraryItemEntity, expect.anything());
  });

  it('reorders the listed items and keeps unlisted (e.g. hidden) ones after them', async () => {
    const members = [
      { item: { id: 'a' }, position: 0, section: null },
      { item: { id: 'hidden' }, position: 1, section: null },
      { item: { id: 'b' }, position: 2, section: null },
    ];
    const { service } = setup({ members });
    await service.reorder('col-1', { items: [{ itemId: 'b', section: 'Day 1' }, { itemId: 'a' }] }, tax);
    expect(members.find((m) => m.item.id === 'b')).toMatchObject({ position: 0, section: 'Day 1' });
    expect(members.find((m) => m.item.id === 'a')).toMatchObject({ position: 1 });
    expect(members.find((m) => m.item.id === 'hidden')).toMatchObject({ position: 2 });
  });

  it('rejects reordering an item that is not a member', async () => {
    const { service } = setup({ members: [] });
    await expect(service.reorder('col-1', { items: [{ itemId: 'zzz' }] }, tax)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("won't add an item the editor can't see", async () => {
    const { service, em, library } = setup();
    library.editableCollection.mockResolvedValue(coll());
    em.find.mockImplementation(async (entity: unknown) =>
      entity === LibraryItemEntity
        ? [
            {
              id: 'i-1',
              status: LibraryItemStatus.Published,
              visibility: LibraryVisibility.Departments,
              uploadedBy: { id: 'u-x' },
              departments: { getItems: () => [{ id: 1 }] },
            },
          ]
        : [],
    );
    await expect(service.addItems('col-1', { itemIds: ['i-1'] }, tax)).rejects.toBeInstanceOf(NotFoundException);
    expect(library.appendToCollection).not.toHaveBeenCalled();
  });

  it('queues a ZIP of only the visible items, within the caps', async () => {
    const { service, outbox } = setup({ rows: [{ item_id: 'a', size_bytes: 10 }, { item_id: 'b', size_bytes: 20 }] });
    await expect(service.requestExport('col-1', tax)).resolves.toEqual({ accepted: true, files: 2 });
    expect(outbox.enqueue).toHaveBeenCalledWith(EVENT.LibraryCollectionExportRequested, {
      collectionId: 'col-1',
      actorUserId: 'u-tax',
      itemIds: ['a', 'b'],
    });
  });

  it('refuses oversized exports', async () => {
    const big = setup({ rows: [{ item_id: 'a', size_bytes: 2 * 1024 * 1024 * 1024 }] });
    await expect(big.service.requestExport('col-1', tax)).rejects.toThrow('over 1 GB');
    const many = setup({ rows: Array.from({ length: 201 }, (_, i) => ({ item_id: `i${i}`, size_bytes: 1 })) });
    await expect(many.service.requestExport('col-1', tax)).rejects.toThrow('200 files');
  });

  it('only presigns export keys under this collection', async () => {
    const { service } = setup();
    await expect(service.exportDownloadUrl('col-1', 'exports/library-collections/other/x.zip', undefined, tax)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.exportDownloadUrl('col-1', 'exports/library-collections/col-1/x.zip', 'IFRS.zip', tax)).resolves.toEqual({
      url: 'https://r2/x.zip',
    });
  });
});
