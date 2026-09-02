import { ConflictException, NotFoundException } from '@nestjs/common';
import { HelpService } from './help.service';
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';

function buildStorage() {
  return { upload: jest.fn(), presignDownload: jest.fn(async () => 'https://example.com/x') };
}

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
    const service = new HelpService(em as never, buildStorage() as never);

    const result = await service.createCategory({ name: 'Engagements', slug: 'engagements', order: 1 });

    expect(em.persistAndFlush).toHaveBeenCalled();
    expect(result).toMatchObject({ name: 'Engagements', slug: 'engagements', order: 1 });
  });

  it('rejects a duplicate slug on create', async () => {
    const em = buildEm({ findOne: jest.fn(async () => ({ id: 'cat-1' })) });
    const service = new HelpService(em as never, buildStorage() as never);

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
    const service = new HelpService(em as never, buildStorage() as never);

    await expect(service.updateCategory('missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('HelpService articles', () => {
  function article(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'art-1',
      category: { id: 'cat-1' },
      title: 'How to raise a request',
      slug: 'how-to-raise-a-request',
      bodyJson: { type: 'doc', content: [] },
      bodyText: 'How to raise a request',
      visibleToRoles: [],
      status: 'published',
      order: 0,
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      publishedAt: new Date('2026-08-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  const clientUser = { userId: 'u-1', role: 'Client' as const, partnerDesignation: null };
  const platformAdmin = { userId: 'u-2', role: 'Platform Admin' as const, partnerDesignation: null };

  it('hides a draft article from a non-manager role by slug', async () => {
    const em = buildEm({ findOne: jest.fn(async () => article({ status: 'draft' })) });
    const service = new HelpService(em as never, buildStorage() as never);

    await expect(service.getArticleBySlug('how-to-raise-a-request', clientUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('shows a draft article to a help:manage role by slug', async () => {
    const em = buildEm({ findOne: jest.fn(async () => article({ status: 'draft' })) });
    const service = new HelpService(em as never, buildStorage() as never);

    const result = await service.getArticleBySlug('how-to-raise-a-request', platformAdmin);
    expect(result.status).toBe('draft');
  });

  it('hides an article scoped to other roles from a Client viewer', async () => {
    const em = buildEm({
      findOne: jest.fn(async () => article({ visibleToRoles: ['Staff', 'Super Admin'] })),
    });
    const service = new HelpService(em as never, buildStorage() as never);

    await expect(service.getArticleBySlug('how-to-raise-a-request', clientUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('shows a role-scoped article to a matching role', async () => {
    const em = buildEm({
      findOne: jest.fn(async () => article({ visibleToRoles: ['Client'] })),
    });
    const service = new HelpService(em as never, buildStorage() as never);

    const result = await service.getArticleBySlug('how-to-raise-a-request', clientUser);
    expect(result.slug).toBe('how-to-raise-a-request');
  });

  it('search excludes drafts and role-mismatched articles', async () => {
    const em = buildEm({ find: jest.fn(async () => [article()]) });
    const service = new HelpService(em as never, buildStorage() as never);

    const results = await service.searchArticles('raise', clientUser);
    expect(em.find).toHaveBeenCalledWith(
      HelpArticleEntity,
      expect.objectContaining({
        status: 'published',
        $or: [{ title: { $ilike: '%raise%' } }, { bodyText: { $ilike: '%raise%' } }],
      }),
      expect.anything(),
    );
    expect(results).toHaveLength(1);
  });
});

describe('HelpService images', () => {
  it('rejects a non-image content type', async () => {
    const em = buildEm();
    const storage = { upload: jest.fn(), presignDownload: jest.fn() };
    const service = new HelpService(em as never, storage as never);

    await expect(
      service.uploadImage({ fileName: 'x.pdf', contentType: 'application/pdf', data: 'abc' }),
    ).rejects.toThrow('Use a JPEG, PNG, or WebP image');
  });

  it('rejects an image over 5 MB', async () => {
    const em = buildEm();
    const storage = { upload: jest.fn(), presignDownload: jest.fn() };
    const service = new HelpService(em as never, storage as never);
    const big = Buffer.alloc(6 * 1024 * 1024).toString('base64');

    await expect(
      service.uploadImage({ fileName: 'x.png', contentType: 'image/png', data: big }),
    ).rejects.toThrow('5 MB');
  });

  it('uploads a valid image and returns its storage key', async () => {
    const em = buildEm();
    const storage = {
      upload: jest.fn(async () => ({ storageKey: 'help-images/abc.png' })),
      presignDownload: jest.fn(),
    };
    const service = new HelpService(em as never, storage as never);

    const result = await service.uploadImage({
      fileName: 'diagram.png',
      contentType: 'image/png',
      data: Buffer.from('fake-bytes').toString('base64'),
    });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({ keyPrefix: 'help-images', fileName: 'diagram.png', contentType: 'image/png' }),
    );
    expect(result).toEqual({ storageKey: 'help-images/abc.png' });
  });

  it('rehydrates image src attributes on read', async () => {
    const storage = {
      upload: jest.fn(),
      presignDownload: jest.fn(async (key: string) => `https://r2.example/${key}?sig=1`),
    };
    const bodyJson = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '', alt: null, storageKey: 'help-images/abc.png' } }],
    };
    const em = buildEm({
      findOne: jest.fn(async () => ({
        id: 'art-1',
        category: { id: 'cat-1' },
        title: 'T',
        slug: 's',
        bodyJson,
        visibleToRoles: [],
        status: 'published',
        order: 0,
        updatedAt: new Date(),
        publishedAt: new Date(),
      })),
    });
    const service = new HelpService(em as never, storage as never);

    const result = await service.getArticleBySlug('s', { role: 'Client', partnerDesignation: null });

    const body = result.bodyJson as { content: Array<{ attrs: { src: string } }> };
    expect(body.content[0]?.attrs.src).toBe('https://r2.example/help-images/abc.png?sig=1');
  });
});
