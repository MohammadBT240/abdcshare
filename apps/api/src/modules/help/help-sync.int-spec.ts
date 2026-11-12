import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { MikroORM } from '@mikro-orm/postgresql';
import { EntityManager } from '@mikro-orm/postgresql';
import { intOrm } from '../../test/int-orm';
import { HelpService } from './help.service';
import { HelpSyncService } from './sync/help-sync.service';

/** Help Center H1 against real Postgres: sync (create / update / keep edits / restore), FTS search, visibility. */
describe('Help sync + search (Postgres)', () => {
  let orm: MikroORM;
  const tag = randomUUID().slice(0, 6);
  const cat = `int-${tag}`;
  const slug = (s: string) => `int-${tag}-${s}`;
  const uploads: { keyPrefix: string; fileName: string }[] = [];
  const storage = {
    upload: jest.fn(async (i: { keyPrefix: string; fileName: string }) => {
      uploads.push(i);
      return { storageKey: `${i.keyPrefix}/${randomUUID()}-${i.fileName}` };
    }),
    head: jest.fn(async () => ({ sizeBytes: 1 })),
    presignDownload: jest.fn(async (k: string) => `https://files.test/${k}`),
  };
  const config = { get: (k: string, d?: string) => (k === 'HELP_SYNC_ON_START' ? 'false' : d) };

  const fork = () => orm.em.fork() as EntityManager;
  const sync = () => new HelpSyncService(fork(), storage as never, config as never);
  const help = () => new HelpService(fork(), storage as never, sync());

  function write(dir: string, files: Record<string, string>) {
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      writeFileSync(path.join(dir, f), body);
    }
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'help-int-'));

  beforeAll(async () => {
    orm = await intOrm();
    write(dir, {
      [`${cat}/_category.md`]: '---\ntitle: Int category\norder: 99\n---\n',
      [`${cat}/${slug('upload')}.md`]: `---\ntitle: Uploading quarterly zephyrfiles\nsummary: How to upload\nrelated: [${slug('partners')}]\n---\n## Steps\n\n1. Click **Upload**.\n2. Choose the zephyrfile.\n\n![Dialog](../images/${tag}.png)\n`,
      [`${cat}/${slug('partners')}.md`]: `---\ntitle: Partner zephyr notes\nroles: [Partner]\n---\nOnly partners read about zephyr reporting.\n`,
      [`images/${tag}.png`]: `png-${tag}`,
    });
  });

  afterAll(async () => {
    const em = fork();
    await em.execute(`delete from help_articles where slug like ?`, [`int-${tag}-%`]);
    await em.execute(`delete from help_categories where slug = ?`, [cat]);
    await orm.close(true);
  });

  it('installs, leaves unchanged articles alone, and uploads each image once', async () => {
    const first = await sync().sync(dir, { retire: false });
    expect(first.errors).toEqual([]);
    expect(first.created.sort()).toEqual([slug('partners'), slug('upload')]);
    expect(first.imagesUploaded).toBe(1);

    const second = await sync().sync(dir, { retire: false });
    expect(second).toMatchObject({ created: [], updated: [], unchanged: 2, imagesUploaded: 0 });
    expect(uploads).toHaveLength(1);

    const [row] = await fork().execute<{ status: string; source: string; summary: string; body_text: string }[]>(
      `select status, source, summary, body_text from help_articles where slug = ?`,
      [slug('upload')],
    );
    expect(row).toMatchObject({ status: 'published', source: 'default', summary: 'How to upload' });
    expect(row!.body_text).toContain('Choose the zephyrfile.');
  });

  it('updates shipped changes, but keeps an article an admin edited until it is restored', async () => {
    write(dir, { [`${cat}/${slug('upload')}.md`]: `---\ntitle: Uploading quarterly zephyrfiles\nsummary: How to upload (v2)\n---\nNew text.\n` });
    expect((await sync().sync(dir, { retire: false })).updated).toEqual([slug('upload')]);

    const id = ((await fork().execute(`select id from help_articles where slug = ?`, [slug('upload')])) as { id: string }[])[0]!.id;
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Admin wording' }] }] };
    await help().updateArticle(id, { bodyJson: doc, bodyText: 'Admin wording' });
    expect((await help().getArticleByIdAdmin(id)).edited).toBe(true);

    write(dir, { [`${cat}/${slug('upload')}.md`]: `---\ntitle: Uploading quarterly zephyrfiles\nsummary: How to upload (v3)\n---\nNewer text.\n` });
    const kept = await sync().sync(dir, { retire: false });
    expect(kept.keptEdited).toEqual([slug('upload')]);
    expect((await help().getArticleByIdAdmin(id)).summary).toBe('How to upload (v2)');

    // Restore uses the configured content dir — point it at ours for the test.
    const restoring = new HelpService(fork(), storage as never, {
      sync: () => sync().sync(dir, { retire: false }),
    } as never);
    const restored = await restoring.restoreDefault(id);
    expect(restored).toMatchObject({ summary: 'How to upload (v3)', edited: false });
  });

  it('searches with ranking and highlights, falls back to ILIKE, and respects designations', async () => {
    const staff = { role: 'Staff' as const, partnerDesignation: null };
    const hits = await help().searchArticles('zephyrfil', staff);
    expect(hits.map((h) => h.slug)).toEqual([slug('upload')]);
    expect(hits[0]).toMatchObject({ category: 'Int category' });

    const partner = { role: 'Super Admin' as const, partnerDesignation: 'Partner' as const };
    const forPartner = await help().searchArticles('zephyr', partner);
    expect(forPartner.map((h) => h.slug).sort()).toEqual([slug('partners'), slug('upload')].sort());
    const note = forPartner.find((h) => h.slug === slug('partners'))!;
    expect(note.snippet).toContain('⟦zephyr⟧');

    // "the" is a stop word: FTS has nothing to match, ILIKE still finds titles.
    const sa = await help().searchArticles('Partner zephyr notes', { role: 'Super Admin' as const, partnerDesignation: null });
    expect(sa.map((h) => h.slug)).not.toContain(slug('partners'));
  });

  it('records one feedback answer per person', async () => {
    const em = fork();
    const [u] = await em.execute<{ id: string }[]>(`select id from users limit 1`);
    const viewer = { userId: u!.id, role: 'Staff' as const, partnerDesignation: null };
    await help().setFeedback(slug('upload'), { helpful: false, comment: 'Missing a step' }, viewer);
    await help().setFeedback(slug('upload'), { helpful: true }, viewer);
    const stats = (await help().feedbackStats()).find((s) => s.slug === slug('upload'))!;
    expect(stats).toMatchObject({ helpful: 1, notHelpful: 0 });
    expect((await help().getArticleBySlug(slug('upload'), viewer)).myFeedback).toBe(true);
  });
});
