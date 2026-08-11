import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompanyProfileService } from './company-profile.service';
import { CompanyProfileEntity } from './infrastructure/persistence/company-profile.entity';

describe('CompanyProfileService', () => {
  const userId = 'user-1';

  function build(overrides: Partial<Record<string, unknown>> = {}) {
    const rows: CompanyProfileEntity[] = [];
    const em = {
      findAndCount: jest.fn(async (_e: unknown, where: Record<string, unknown>) => {
        const filtered = rows.filter((r) => {
          if (where.isActive !== undefined && r.isActive !== where.isActive) return false;
          const sk = where.storageKey as { $ne?: null } | undefined;
          if (sk && '$ne' in sk && sk.$ne === null && (r.storageKey == null)) return false;
          const nameFilter = where.name as { $ilike?: string } | undefined;
          if (nameFilter?.$ilike) {
            const needle = nameFilter.$ilike.replace(/%/g, '').toLowerCase();
            if (!r.name.toLowerCase().includes(needle)) return false;
          }
          return true;
        });
        return [filtered, filtered.length];
      }),
      findOne: jest.fn(async (_e: unknown, where: Record<string, unknown>) => {
        return (
          rows.find(
            (r) =>
              r.id === where.id &&
              (where.isActive === undefined || r.isActive === where.isActive),
          ) ?? null
        );
      }),
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => {
        const row = {
          id: 'profile-1',
          ...data,
          createdBy: data.createdBy ? { id: userId, fullName: 'Ada' } : null,
        } as unknown as CompanyProfileEntity;
        rows.push(row);
        return row;
      }),
      persistAndFlush: jest.fn(async () => undefined),
      flush: jest.fn(async () => undefined),
      populate: jest.fn(async () => undefined),
      removeAndFlush: jest.fn(async (row: CompanyProfileEntity) => {
        const idx = rows.indexOf(row);
        if (idx >= 0) rows.splice(idx, 1);
      }),
      getReference: jest.fn((_e: unknown, id: string) => ({ id })),
      ...overrides,
    };
    const storage = {
      upload: jest.fn(async () => ({ storageKey: 'company-profiles/key.pdf' })),
      head: jest.fn(async () => ({ sizeBytes: 1024 })),
      presignDownload: jest.fn(async () => 'https://example.com/file.pdf'),
      presignUpload: jest.fn(async () => ({
        storageKey: 'company-profiles/new.pdf',
        uploadUrl: 'https://upload.example.com',
        method: 'PUT' as const,
        headers: {},
        expiresIn: 900,
      })),
    };
    const service = new CompanyProfileService(em as never, storage as never);
    return { service, em, storage, rows };
  }

  it('lists only active complete profiles and supports name search', async () => {
    const { service, rows } = build();
    rows.push(
      {
        id: 'a',
        name: 'Alpha pack',
        fileName: 'a.pdf',
        storageKey: 'company-profiles/a.pdf',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CompanyProfileEntity,
      {
        id: 'draft',
        name: 'Draft',
        fileName: null,
        storageKey: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CompanyProfileEntity,
      {
        id: 'b',
        name: 'Beta',
        fileName: 'b.pdf',
        storageKey: 'company-profiles/b.pdf',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CompanyProfileEntity,
    );

    const all = await service.list({ page: 1, pageSize: 20 });
    expect(all.data).toHaveLength(1);
    expect(all.data[0]?.name).toBe('Alpha pack');

    const searched = await service.list({ page: 1, pageSize: 20, q: 'alpha' });
    expect(searched.data).toHaveLength(1);
  });

  it('creates a draft with name only', async () => {
    const { service, storage, em } = build();
    const result = await service.createDraft({ name: 'Firm pack' }, userId);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(em.persistAndFlush).toHaveBeenCalled();
    expect(result.name).toBe('Firm pack');
    expect(result.fileName).toBeNull();
    expect(result.id).toBe('profile-1');
  });

  it('rejects draft create without name', async () => {
    const { service } = build();
    await expect(service.createDraft({ name: '' }, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('confirms an uploaded file onto a draft', async () => {
    const { service, rows, storage } = build();
    rows.push({
      id: 'profile-1',
      name: 'Firm pack',
      fileName: null,
      storageKey: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyProfileEntity);

    const result = await service.confirmUpload('profile-1', {
      storageKey: 'company-profiles/pack.pdf',
      fileName: 'pack.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(storage.head).toHaveBeenCalled();
    expect(result.fileName).toBe('pack.pdf');
    expect(rows[0]?.storageKey).toBe('company-profiles/pack.pdf');
  });

  it('hard-deletes drafts and soft-deletes complete profiles', async () => {
    const { service, rows, em } = build();
    rows.push({
      id: 'draft-1',
      name: 'Draft',
      fileName: null,
      storageKey: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyProfileEntity);

    await service.remove('draft-1');
    expect(em.removeAndFlush).toHaveBeenCalled();

    rows.push({
      id: 'profile-1',
      name: 'X',
      fileName: 'x.pdf',
      storageKey: 'k',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyProfileEntity);

    await service.remove('profile-1');
    expect(rows.find((r) => r.id === 'profile-1')?.isActive).toBe(false);
    await expect(service.get('profile-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a download URL', async () => {
    const { service, rows, storage } = build();
    rows.push({
      id: 'profile-1',
      name: 'X',
      fileName: 'x.pdf',
      storageKey: 'k',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyProfileEntity);

    const result = await service.download('profile-1');
    expect(storage.presignDownload).toHaveBeenCalledWith('k', 'x.pdf');
    expect(result.url).toBe('https://example.com/file.pdf');
  });

  it('returns a native preview URL for PDFs', async () => {
    const { service, rows, storage } = build();
    rows.push({
      id: 'profile-1',
      name: 'X',
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      storageKey: 'k',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyProfileEntity);

    const result = await service.preview('profile-1');
    expect(storage.presignDownload).toHaveBeenCalledWith('k', 'x.pdf', {
      disposition: 'inline',
    });
    expect(result).toMatchObject({
      url: 'https://example.com/file.pdf',
      mode: 'native',
      previewStatus: 'Ready',
    });
  });

  it('marks Word files as unsupported for local (non-public) storage URLs', async () => {
    const { service, rows, storage } = build();
    storage.presignDownload = jest.fn(
      async () => 'http://localhost:3001/api/storage/local/k?inline=x.docx',
    );
    rows.push({
      id: 'profile-1',
      name: 'X',
      fileName: 'x.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storageKey: 'k',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyProfileEntity);

    const result = await service.preview('profile-1');
    expect(result).toMatchObject({
      url: null,
      mode: 'unavailable',
      reason: 'unsupported',
    });
  });

  it('embeds Word files via Office Online when the object URL is public HTTPS', async () => {
    const { service, rows, storage } = build();
    storage.presignDownload = jest.fn(async () => 'https://cdn.example.com/file.docx');
    rows.push({
      id: 'profile-1',
      name: 'X',
      fileName: 'x.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storageKey: 'k',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyProfileEntity);

    const result = await service.preview('profile-1');
    expect(result.mode).toBe('converted');
    expect(result.url).toContain('view.officeapps.live.com');
    expect(result.url).toContain(encodeURIComponent('https://cdn.example.com/file.docx'));
  });
});
