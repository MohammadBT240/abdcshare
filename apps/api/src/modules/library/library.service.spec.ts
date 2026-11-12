import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RawQueryFragment } from '@mikro-orm/core';
import { EVENT, FilePreviewStatus, LibraryItemStatus, LibraryVisibility } from '@abdcshare/shared';
import { LibraryService } from './library.service';
import { LibraryCategoryEntity } from './infrastructure/persistence/library-category.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type { LibraryViewer } from './library-access';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const staff: LibraryViewer = { userId: 'u-staff', departmentId: 2, isCurator: false };
const other: LibraryViewer = { userId: 'u-other', departmentId: 2, isCurator: false };
const curator: LibraryViewer = { userId: 'u-sa', departmentId: null, isCurator: true };

function collection(items: { id: number; name: string }[] = []) {
  let current = [...items];
  return {
    isInitialized: () => true,
    getItems: () => current,
    removeAll: jest.fn(() => {
      current = [];
    }),
    set: jest.fn((next: { id: number; name: string }[]) => {
      current = [...next];
    }),
  };
}

type FakeItem = Record<string, unknown> & { departments: ReturnType<typeof collection> };

function fakeItem(overrides: Record<string, unknown> = {}): FakeItem {
  return {
    id: 'item-1',
    title: 'IFRS 17 primer',
    description: null,
    category: { id: 'cat-1', name: 'Research Papers' },
    authors: null,
    publishedYear: 2025,
    source: null,
    tags: [],
    visibility: LibraryVisibility.Firm,
    departments: collection(),
    status: LibraryItemStatus.Published,
    storageKey: 'abdcshare/library/item-1/aaa-primer.pdf',
    fileName: 'primer.pdf',
    mimeType: PDF,
    sizeBytes: 1000,
    previewStorageKey: null,
    previewStatus: FilePreviewStatus.Ready,
    previewError: null,
    uploadedBy: { id: 'u-staff', fullName: 'Amina Staff' },
    publishedAt: new Date('2026-11-01'),
    archivedAt: null,
    archivedBy: null,
    viewCount: 0,
    downloadCount: 0,
    createdAt: new Date('2026-11-01'),
    updatedAt: new Date('2026-11-01'),
    ...overrides,
  };
}

function setup(opts: { item?: FakeItem | null; category?: unknown; departments?: unknown[] } = {}) {
  const execute = jest.fn(async () => []);
  const em = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === LibraryItemEntity) return opts.item === undefined ? fakeItem() : opts.item;
      if (entity === LibraryCategoryEntity) {
        return opts.category === undefined ? { id: 'cat-1', name: 'Research Papers', isActive: true } : opts.category;
      }
      if (entity === UserEntity) return { id: 'u-staff', department: { id: 2 } };
      return null;
    }),
    find: jest.fn(async (entity: unknown) => (entity === DepartmentEntity ? (opts.departments ?? []) : [])),
    findAndCount: jest.fn(async (..._args: unknown[]) => [[], 0] as [unknown[], number]),
    create: jest.fn((_e: unknown, data: Record<string, unknown>) => ({
      id: 'item-new',
      departments: collection(),
      previewStatus: FilePreviewStatus.None,
      viewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      uploadedBy: { id: 'u-staff', fullName: 'Amina Staff' },
    })),
    persistAndFlush: jest.fn(),
    persist: jest.fn(),
    flush: jest.fn(),
    removeAndFlush: jest.fn(),
    getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
    getConnection: jest.fn(() => ({ execute })),
    execute,
    nativeDelete: jest.fn(async () => 1),
  };
  Object.assign(em, { transactional: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(em)) });
  const storage = {
    presignUpload: jest.fn(async () => ({ storageKey: 'k', uploadUrl: 'u', method: 'PUT', headers: {}, expiresIn: 900 })),
    presignDownload: jest.fn(async (key: string) => `https://r2.example/${key}`),
    head: jest.fn(async () => ({ sizeBytes: 2048 })),
    delete: jest.fn(async () => undefined),
  };
  const outbox = { enqueue: jest.fn() };
  const events = {
    stage: jest.fn((..._a: unknown[]) => undefined as unknown),
    insertNow: jest.fn(async (..._a: unknown[]) => undefined),
    snapshotTitle: jest.fn(async (..._a: unknown[]) => undefined),
  };
  const service = new LibraryService(em as never, storage as never, outbox as never, events as never);
  return { service, em, storage, outbox, execute, events };
}

describe('LibraryService.viewer', () => {
  it('loads the department from the user row and derives curator from permissions', async () => {
    const { service } = setup();
    await expect(service.viewer({ userId: 'u-staff', role: 'Staff' } as never)).resolves.toEqual({
      userId: 'u-staff',
      departmentId: 2,
      isCurator: false,
      ip: null,
      userAgent: null,
    });
    await expect(service.viewer({ userId: 'u-staff', role: 'Super Admin' } as never)).resolves.toMatchObject({
      isCurator: true,
    });
  });
});

describe('LibraryService.create', () => {
  it('creates a firm-wide Draft with normalised tags', async () => {
    const { service, em } = setup();
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === LibraryCategoryEntity) return { id: 'cat-1', name: 'Research Papers', isActive: true };
      if (entity === LibraryItemEntity) return em.persist.mock.calls[0]?.[0] ?? null;
      return null;
    });
    const result = await service.create(
      { declaration: true, title: '  IFRS 17 primer ', categoryId: 'cat-1', tags: ['IFRS', ' ifrs ', 'Insurance  Contracts'] },
      staff,
    );
    expect(result).toMatchObject({
      title: 'IFRS 17 primer',
      status: LibraryItemStatus.Draft,
      visibility: LibraryVisibility.Firm,
      tags: ['ifrs', 'insurance contracts'],
      canEdit: true,
    });
  });

  it('rejects an inactive or unknown category', async () => {
    const { service } = setup({ category: null });
    await expect(service.create({ declaration: true, title: 'x', categoryId: 'cat-x' }, staff)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires departments when visibility is Departments', async () => {
    const { service } = setup();
    await expect(
      service.create({ declaration: true, title: 'x', categoryId: 'cat-1', visibility: LibraryVisibility.Departments }, staff),
    ).rejects.toThrow('Choose at least one department');
  });

  it('rejects unknown or inactive departments', async () => {
    const { service } = setup({ departments: [{ id: 1, name: 'Audit' }] });
    await expect(
      service.create(
        { declaration: true, title: 'x', categoryId: 'cat-1', visibility: LibraryVisibility.Departments, departmentIds: [1, 99] },
        staff,
      ),
    ).rejects.toThrow('Unknown or inactive department');
  });
});

describe('LibraryService edit rights', () => {
  it("forbids editing someone else's item", async () => {
    const { service } = setup();
    await expect(service.update('item-1', { title: 'Mine now' }, other)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a curator edit any item', async () => {
    const { service } = setup();
    await expect(service.update('item-1', { title: 'Retitled' }, curator)).resolves.toMatchObject({ title: 'Retitled' });
  });

  it('returns 404 (not 403) for an item the viewer cannot see', async () => {
    const { service } = setup({
      item: fakeItem({
        uploadedBy: { id: 'u-x', fullName: 'X' },
        visibility: LibraryVisibility.Departments,
        departments: collection([{ id: 1, name: 'Audit' }]),
      }),
    });
    await expect(service.get('item-1', staff)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('item-1', { title: 'x' }, staff)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('switching to firm-wide clears departments', async () => {
    const item = fakeItem({ visibility: LibraryVisibility.Departments, departments: collection([{ id: 2, name: 'Tax' }]) });
    const { service } = setup({ item });
    const result = await service.update('item-1', { visibility: LibraryVisibility.Firm }, staff);
    expect(item.departments.removeAll).toHaveBeenCalled();
    expect(result.departments).toEqual([]);
  });
});

describe('LibraryService.confirmUpload', () => {
  const key = 'abdcshare/library/item-1/bbb-report.docx';

  it('rejects a storage key from another item', async () => {
    const { service } = setup({ item: fakeItem({ status: LibraryItemStatus.Draft, storageKey: null }) });
    await expect(
      service.confirmUpload('item-1', { storageKey: 'abdcshare/library/item-2/x.pdf', fileName: 'x.pdf', mimeType: PDF, declaration: true }, staff),
    ).rejects.toThrow('Invalid storage key');
  });

  it('rejects disallowed types and renamed files', async () => {
    const { service } = setup({ item: fakeItem({ status: LibraryItemStatus.Draft, storageKey: null }) });
    await expect(
      service.confirmUpload('item-1', { storageKey: key, fileName: 'evil.html', mimeType: 'text/html', declaration: true }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.confirmUpload('item-1', { storageKey: key, fileName: 'evil.exe', mimeType: PDF, declaration: true }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects files over 100 MB (measured by HEAD, not the client)', async () => {
    const { service, storage } = setup({ item: fakeItem({ status: LibraryItemStatus.Draft, storageKey: null }) });
    storage.head.mockResolvedValueOnce({ sizeBytes: 101 * 1024 * 1024 });
    await expect(
      service.confirmUpload('item-1', { storageKey: key, fileName: 'big.pdf', mimeType: PDF, declaration: true }, staff),
    ).rejects.toThrow('100 MB');
  });

  it('publishes a Draft and queues an Office preview in the same flush', async () => {
    const item = fakeItem({ status: LibraryItemStatus.Draft, storageKey: null, fileName: null, publishedAt: null });
    const { service, outbox, em } = setup({ item });
    const result = await service.confirmUpload('item-1', { storageKey: key, fileName: 'report.docx', mimeType: DOCX, declaration: true }, staff);
    expect(result.status).toBe(LibraryItemStatus.Published);
    expect(item.publishedAt).toBeInstanceOf(Date);
    expect(result.previewStatus).toBe(FilePreviewStatus.Pending);
    expect(outbox.enqueue).toHaveBeenCalledWith(EVENT.FilePreviewRequested, {
      entityType: 'library_item',
      fileId: 'item-1',
      storageKey: key,
      fileName: 'report.docx',
      mimeType: DOCX,
    });
    expect(outbox.enqueue.mock.invocationCallOrder[0]).toBeLessThan(em.flush.mock.invocationCallOrder[0]!);
  });

  it('does not queue a preview for natively viewable PDFs', async () => {
    const { service, outbox } = setup({ item: fakeItem({ status: LibraryItemStatus.Draft, storageKey: null }) });
    const result = await service.confirmUpload(
      'item-1',
      { storageKey: 'abdcshare/library/item-1/ccc-a.pdf', fileName: 'a.pdf', mimeType: PDF, declaration: true },
      staff,
    );
    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(result.previewStatus).toBe(FilePreviewStatus.Ready);
  });

  it('replacing a file deletes the old object and old preview after commit', async () => {
    const item = fakeItem({
      mimeType: DOCX,
      fileName: 'old.docx',
      storageKey: 'abdcshare/library/item-1/old.docx',
      previewStorageKey: 'abdcshare/previews/old.pdf',
    });
    const { service, storage, em } = setup({ item });
    await service.confirmUpload('item-1', { storageKey: key, fileName: 'report.docx', mimeType: DOCX, declaration: true }, staff);
    expect(storage.delete).toHaveBeenCalledWith('abdcshare/library/item-1/old.docx');
    expect(storage.delete).toHaveBeenCalledWith('abdcshare/previews/old.pdf');
    expect(em.flush.mock.invocationCallOrder[0]!).toBeLessThan(storage.delete.mock.invocationCallOrder[0]!);
    expect(item.previewStorageKey).toBeNull();
  });

  it('refuses file changes on archived items', async () => {
    const { service } = setup({ item: fakeItem({ status: LibraryItemStatus.Archived }) });
    await expect(
      service.confirmUpload('item-1', { storageKey: key, fileName: 'report.docx', mimeType: DOCX, declaration: true }, staff),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('LibraryService lifecycle', () => {
  it('archives a published item and records who did it', async () => {
    const item = fakeItem();
    const { service } = setup({ item });
    const result = await service.archive('item-1', staff);
    expect(result.status).toBe(LibraryItemStatus.Archived);
    expect(item.archivedBy).toEqual({ id: 'u-staff' });
  });

  it('only restores archived items', async () => {
    const { service } = setup();
    await expect(service.restore('item-1', staff)).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks deleting a published item, even for curators', async () => {
    const { service } = setup();
    await expect(service.remove('item-1', curator)).rejects.toThrow('Archive the item before deleting it');
  });

  it('blocks non-curators from deleting', async () => {
    const { service } = setup({ item: fakeItem({ status: LibraryItemStatus.Archived }) });
    await expect(service.remove('item-1', staff)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes an archived item and its stored objects', async () => {
    const { service, em, storage } = setup({
      item: fakeItem({ status: LibraryItemStatus.Archived, previewStorageKey: 'abdcshare/previews/p.pdf' }),
    });
    await service.remove('item-1', curator);
    expect(em.nativeDelete).toHaveBeenCalledWith(LibraryItemEntity, { id: 'item-1' });
    expect(storage.delete).toHaveBeenCalledWith('abdcshare/library/item-1/aaa-primer.pdf');
    expect(storage.delete).toHaveBeenCalledWith('abdcshare/previews/p.pdf');
  });
});

describe('LibraryService.preview', () => {
  it('serves PDFs inline and counts the view', async () => {
    const { service, storage, execute } = setup();
    const result = await service.preview('item-1', other);
    expect(result).toMatchObject({ mode: 'native', url: expect.stringContaining('aaa-primer.pdf') });
    expect(storage.presignDownload).toHaveBeenCalledWith(expect.any(String), 'primer.pdf', { disposition: 'inline' });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('"view_count" = "view_count" + 1'), ['item-1']);
  });

  it('serves the converted PDF for Office files once ready', async () => {
    const { service } = setup({
      item: fakeItem({ mimeType: DOCX, fileName: 'r.docx', previewStatus: FilePreviewStatus.Ready, previewStorageKey: 'p/r.pdf' }),
    });
    await expect(service.preview('item-1', other)).resolves.toMatchObject({ mode: 'converted', url: 'https://r2.example/p/r.pdf' });
  });

  it('reports pending conversions without counting a view', async () => {
    const { service, execute } = setup({
      item: fakeItem({ mimeType: DOCX, fileName: 'r.docx', previewStatus: FilePreviewStatus.Pending }),
    });
    await expect(service.preview('item-1', other)).resolves.toMatchObject({ mode: 'unavailable', reason: 'pending' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('lets the uploader retry a failed conversion, but not other viewers', async () => {
    const failed = () => fakeItem({ mimeType: DOCX, fileName: 'r.docx', previewStatus: FilePreviewStatus.Failed });
    const a = setup({ item: failed() });
    await expect(a.service.preview('item-1', other, { retry: true })).resolves.toMatchObject({ reason: 'failed' });
    expect(a.outbox.enqueue).not.toHaveBeenCalled();

    const b = setup({ item: failed() });
    await expect(b.service.preview('item-1', staff, { retry: true })).resolves.toMatchObject({ reason: 'pending' });
    expect(b.outbox.enqueue).toHaveBeenCalledWith(EVENT.FilePreviewRequested, expect.objectContaining({ entityType: 'library_item' }));
  });
});

describe('LibraryService.list', () => {
  function rawSql(where: Record<string, unknown>): string[] {
    return Object.keys(where)
      .filter((k) => k.startsWith('[raw]'))
      .map((k) => String(RawQueryFragment.getKnownFragment(k)?.sql ?? ''));
  }

  it('applies the visibility scope in SQL for non-curators', async () => {
    const { service, em } = setup();
    await service.list({ page: 1, pageSize: 20 }, staff);
    const where = em.findAndCount.mock.calls[0]![1] as Record<string, unknown>;
    expect(where.status).toBe(LibraryItemStatus.Published);
    expect(rawSql(where).join(' ')).toContain('library_item_departments');
  });

  it('parenthesises the tag predicate (`x = any(tags) = true` is a Postgres syntax error)', async () => {
    const { service, em } = setup();
    await service.list({ page: 1, pageSize: 20, tag: ' Tax ' }, curator);
    const where = em.findAndCount.mock.calls[0]![1] as Record<string, unknown>;
    // Fragments are consumed on read, so read each once.
    const fragments = Object.keys(where)
      .filter((k) => k.startsWith('[raw]'))
      .map((k) => RawQueryFragment.getKnownFragment(k)!);
    const tag = fragments.find((f) => String(f.sql).includes('any('))!;
    // MikroORM stores alias callbacks with an `[::alias::]` placeholder it swaps for the real alias.
    expect(String(tag.sql)).toBe('(? = any([::alias::].tags))');
    expect(tag.params).toEqual(['tax']);
  });

  it('does not restrict curators', async () => {
    const { service, em } = setup();
    await service.list({ page: 1, pageSize: 20 }, curator);
    expect(rawSql(em.findAndCount.mock.calls[0]![1] as Record<string, unknown>)).toEqual([]);
  });

  it('lists own uploads (including archived) under mine', async () => {
    const { service, em } = setup();
    await service.list({ page: 1, pageSize: 20, mine: true, status: LibraryItemStatus.Archived }, staff);
    const where = em.findAndCount.mock.calls[0]![1] as Record<string, unknown>;
    expect(where).toMatchObject({ status: LibraryItemStatus.Archived, uploadedBy: 'u-staff' });
  });

  it("refuses to list other people's archived items for non-curators", async () => {
    const { service } = setup();
    await expect(
      service.list({ page: 1, pageSize: 20, status: LibraryItemStatus.Archived }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('searches metadata with full-text + title fallback and ranks by relevance', async () => {
    const { service, em } = setup();
    await service.list({ page: 1, pageSize: 20, q: 'ifrs 17' }, curator);
    const [, where, options] = em.findAndCount.mock.calls[0]! as unknown as [unknown, Record<string, unknown>, { orderBy: Record<string, unknown> }];
    expect(rawSql(where).join(' ')).toContain("websearch_to_tsquery('english', ?)");
    expect(Object.keys(options.orderBy)[0]).toMatch(/^\[raw\]/);
  });

  it('rejects an unknown sort', async () => {
    const { service } = setup();
    await expect(service.list({ page: 1, pageSize: 20, sort: 'title; drop table' as never }, staff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('LibraryService S2 — declaration, view-only, activity log', () => {
  const key = 'abdcshare/library/item-1/bbb-new.pdf';

  it('refuses to create an item without the upload declaration', async () => {
    const { service } = setup();
    await expect(service.create({ title: 'x', categoryId: 'cat-1' } as never, staff)).rejects.toThrow(
      'Confirm the upload declaration',
    );
  });

  it('stamps the declaration and sharing fields on create', async () => {
    const { service, em } = setup();
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === LibraryCategoryEntity) return { id: 'cat-1', name: 'Research Papers', isActive: true };
      if (entity === LibraryItemEntity) return em.persist.mock.calls[0]?.[0] ?? null;
      return null;
    });
    await service.create(
      { declaration: true, title: 'Licensed deck', categoryId: 'cat-1', licence: 'Licensed' as never, downloadable: false },
      staff,
    );
    const created = em.create.mock.calls.find((c) => c[0] === LibraryItemEntity)?.[1] as Record<string, unknown>;
    expect(created).toMatchObject({ licence: 'Licensed', downloadable: false, declaredBy: { id: 'u-staff' } });
    expect(created.declaredAt).toBeInstanceOf(Date);
  });

  it('defaults licence to InternalUseOnly and downloadable to true', async () => {
    const { service, em } = setup();
    em.findOne.mockImplementation(async (entity: unknown) =>
      entity === LibraryCategoryEntity ? { id: 'cat-1', name: 'R', isActive: true } : (em.persist.mock.calls[0]?.[0] ?? null),
    );
    await service.create({ declaration: true, title: 'x', categoryId: 'cat-1' }, staff);
    const created = em.create.mock.calls.find((c) => c[0] === LibraryItemEntity)?.[1] as Record<string, unknown>;
    expect(created).toMatchObject({ licence: 'InternalUseOnly', downloadable: true });
  });

  it('requires a fresh declaration to replace a published file, and logs FileReplaced', async () => {
    const item = fakeItem();
    const { service, events } = setup({ item });
    await expect(service.confirmUpload('item-1', { storageKey: key, fileName: 'new.pdf', mimeType: PDF }, staff)).rejects.toThrow(
      'Confirm the upload declaration',
    );
    await service.confirmUpload('item-1', { storageKey: key, fileName: 'new.pdf', mimeType: PDF, declaration: true }, staff);
    expect(item.declaredBy).toEqual({ id: 'u-staff' });
    expect(events.stage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FileReplaced',
        itemId: 'item-1',
        metadata: expect.objectContaining({ fileName: 'new.pdf', previousFileName: 'primer.pdf' }),
      }),
    );
  });

  it('publishes a draft declared at create without asking again, and logs Uploaded', async () => {
    const item = fakeItem({ status: LibraryItemStatus.Draft, storageKey: null, fileName: null, declaredAt: new Date() });
    const { service, events } = setup({ item });
    await service.confirmUpload('item-1', { storageKey: key, fileName: 'new.pdf', mimeType: PDF }, staff);
    expect(events.stage).toHaveBeenCalledWith(expect.objectContaining({ action: 'Uploaded', itemId: 'item-1' }));
  });

  it('stages the event before the flush, so a failed flush rolls both back', async () => {
    const item = fakeItem({ status: LibraryItemStatus.Draft, storageKey: null, fileName: null, declaredAt: new Date() });
    const { service, events, em } = setup({ item });
    const order: string[] = [];
    events.stage.mockImplementation(() => order.push('stage'));
    em.flush.mockImplementation(async () => {
      order.push('flush');
      throw new Error('db down');
    });
    await expect(service.confirmUpload('item-1', { storageKey: key, fileName: 'new.pdf', mimeType: PDF }, staff)).rejects.toThrow(
      'db down',
    );
    expect(order).toEqual(['stage', 'flush']);
    expect(events.insertNow).not.toHaveBeenCalled();
  });

  it('logs Edited with the changed field names and VisibilityChanged separately', async () => {
    const item = fakeItem();
    const { service, events } = setup({ item, departments: [{ id: 3, name: 'Tax' }] });
    await service.update('item-1', { title: 'New title', licence: 'Licensed' as never, visibility: LibraryVisibility.Departments, departmentIds: [3] }, staff);
    expect(events.stage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Edited', metadata: { fields: ['title', 'licence'] } }),
    );
    expect(events.stage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VisibilityChanged',
        metadata: { from: 'Firm', to: 'Departments', departments: ['Tax'] },
      }),
    );
  });

  it('logs nothing for a no-op edit', async () => {
    const { service, events } = setup();
    await service.update('item-1', { title: 'IFRS 17 primer' }, staff);
    expect(events.stage).not.toHaveBeenCalled();
  });

  it('logs Archived and Restored', async () => {
    const item = fakeItem();
    const { service, events } = setup({ item });
    await service.archive('item-1', staff);
    await service.restore('item-1', staff);
    expect(events.stage.mock.calls.map((c) => (c[0] as { action: string }).action)).toEqual(['Archived', 'Restored']);
  });

  it('snapshots the title and logs Deleted inside the delete transaction', async () => {
    const { service, events, em } = setup({ item: fakeItem({ status: LibraryItemStatus.Archived }) });
    await service.remove('item-1', curator);
    expect((em as unknown as { transactional: jest.Mock }).transactional).toHaveBeenCalled();
    expect(events.snapshotTitle).toHaveBeenCalledWith('item-1', 'IFRS 17 primer');
    expect(events.insertNow).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Deleted', metadata: expect.objectContaining({ itemTitle: 'IFRS 17 primer' }) }),
    );
  });

  it('logs every view and download (no de-duplication) with the request context', async () => {
    const { service, events } = setup();
    const withCtx = { ...staff, ip: '10.0.0.7', userAgent: 'Mozilla/5.0' };
    await service.preview('item-1', withCtx);
    await service.preview('item-1', withCtx);
    await service.download('item-1', withCtx);
    expect(events.insertNow.mock.calls.map((c) => (c[0] as { action: string }).action)).toEqual([
      'Viewed',
      'Viewed',
      'Downloaded',
    ]);
    expect(events.insertNow).toHaveBeenCalledWith(expect.objectContaining({ viewer: withCtx, itemId: 'item-1' }));
  });

  it('refuses downloads of view-only items to non-editors (403) but still previews them', async () => {
    const { service, events } = setup({ item: fakeItem({ downloadable: false, uploadedBy: { id: 'u-sa', fullName: 'SA' } }) });
    await expect(service.download('item-1', other)).rejects.toBeInstanceOf(ForbiddenException);
    expect(events.insertNow).not.toHaveBeenCalled();
    await expect(service.preview('item-1', other)).resolves.toMatchObject({ mode: 'native' });
  });

  it('lets the uploader and curators download a view-only item', async () => {
    const mine = setup({ item: fakeItem({ downloadable: false }) });
    await expect(mine.service.download('item-1', staff)).resolves.toHaveProperty('url');
    const cur = setup({ item: fakeItem({ downloadable: false }) });
    await expect(cur.service.download('item-1', curator)).resolves.toHaveProperty('url');
  });

  it('tells the client whether it may download', async () => {
    const { service } = setup({ item: fakeItem({ downloadable: false, uploadedBy: { id: 'u-sa', fullName: 'SA' } }) });
    await expect(service.get('item-1', other)).resolves.toMatchObject({ downloadable: false, canDownload: false, openReports: 0 });
  });

  it('only lets the uploader and curators read the activity timeline', async () => {
    const { service } = setup();
    await expect(service.assertCanSeeActivity('item-1', other)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertCanSeeActivity('item-1', staff)).resolves.toBeUndefined();
    await expect(service.assertCanSeeActivity('item-1', curator)).resolves.toBeUndefined();
  });
});
