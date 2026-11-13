import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  articleContentHash,
  canonicalJson,
  defaultHelpContentDir,
  loadHelpContent,
  resolveHelpLink,
  swapAssetKeys,
} from './help-content';

describe('docs/help (the shipped articles)', () => {
  // cwd is apps/api under jest, like the API itself.
  const content = loadHelpContent(defaultHelpContentDir());

  it('has no broken links, unknown roles, missing images or duplicate slugs', () => {
    expect(content.errors).toEqual([]);
  });

  it('gives every article a title and a summary', () => {
    expect(content.articles.length).toBeGreaterThan(10);
    for (const a of content.articles) {
      expect([a.file, a.title.length > 3]).toEqual([a.file, true]);
      expect([a.file, Boolean(a.summary)]).toEqual([a.file, true]);
    }
  });
});

describe('loadHelpContent', () => {
  function folder(files: Record<string, string>): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'help-'));
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      writeFileSync(path.join(dir, f), body);
    }
    return dir;
  }

  it('reads categories, articles and images, and reports problems', () => {
    const dir = folder({
      'basics/_category.md': '---\ntitle: Basics\norder: 2\nicon: rocket\n---\n',
      'basics/one.md': '---\ntitle: One\nsummary: First\nroles: [Staff, Partner]\nrelated: [two]\n---\n## Hi\n\n![Shot](../images/x.png)\n\nSee [two](help:two#a).',
      'basics/two.md': '---\ntitle: Two\nroles: [Nobody]\n---\nGo to [missing](./missing.md).',
      'images/x.png': 'not really a png',
      'empty/readme.txt': 'no _category.md here',
    });
    const c = loadHelpContent(dir);
    expect(c.categories).toEqual([{ slug: 'basics', name: 'Basics', order: 2, icon: 'rocket', description: null }]);
    const one = c.articles.find((a) => a.slug === 'one')!;
    expect(one).toMatchObject({ categorySlug: 'basics', title: 'One', summary: 'First', visibleToRoles: ['Staff', 'Partner'], related: ['two'] });
    expect(one.images).toHaveLength(1);
    expect(JSON.stringify(one.bodyJson)).toContain(`"storageKey":"asset:${one.images[0]!.hash}"`);
    expect(JSON.stringify(one.bodyJson)).toContain('"href":"/help/two#a"');
    expect(c.errors).toEqual(
      expect.arrayContaining([
        'empty: missing _category.md',
        'basics/two.md: unknown role "Nobody" (use Platform Admin, Super Admin, Staff, Client, Guest, Partner, PrincipalPartner)',
        'basics/two.md: links to unknown article "missing"',
      ]),
    );
  });
});

describe('helpers', () => {
  it('resolves help links', () => {
    expect(resolveHelpLink('help:library-uploading#declaration')).toEqual({ href: '/help/library-uploading#declaration', slug: 'library-uploading' });
    expect(resolveHelpLink('../library/library-collections.md')).toEqual({ href: '/help/library-collections', slug: 'library-collections' });
    expect(resolveHelpLink('/library')).toEqual({ href: '/library', slug: null });
    expect(resolveHelpLink('https://example.com/x.md')).toEqual({ href: 'https://example.com/x.md', slug: null });
  });

  it('hashes content independently of key order and role order', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: null }] })).toBe('{"a":[{"c":null,"d":1}],"b":1}');
    const a = articleContentHash({ title: 'T', summary: null, bodyJson: { type: 'doc', content: [] }, visibleToRoles: ['Staff', 'Client'] });
    const b = articleContentHash({ title: 'T', bodyJson: { content: [], type: 'doc' }, visibleToRoles: ['Client', 'Staff'] });
    expect(a).toBe(b);
    expect(articleContentHash({ title: 'T2', bodyJson: {}, visibleToRoles: [] })).not.toBe(a);
  });

  it('swaps asset placeholders for storage keys', () => {
    const doc = { type: 'doc', content: [{ type: 'image', attrs: { storageKey: 'asset:abc', alt: 'x' } }] };
    expect(swapAssetKeys(doc, new Map([['abc', 'help-images/defaults/k.webp']]))).toEqual({
      type: 'doc',
      content: [{ type: 'image', attrs: { storageKey: 'help-images/defaults/k.webp', alt: 'x' } }],
    });
  });
});
