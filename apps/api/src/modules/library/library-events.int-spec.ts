import { randomUUID } from 'node:crypto';
import type { MikroORM } from '@mikro-orm/postgresql';
import { EntityManager } from '@mikro-orm/postgresql';
import { LibraryEventAction } from '@abdcshare/shared';
import { intOrm } from '../../test/int-orm';
import { LibraryEventsService } from './library-events.service';

/**
 * S2 activity log against real Postgres: transactional staging, append-only trigger,
 * delete → title snapshot + FK set null, keyset cursor, and the timeline index.
 */
describe('library_events (Postgres)', () => {
  let orm: MikroORM;
  let em: EntityManager;
  let events: LibraryEventsService;
  let userId: string;
  let categoryId: string;
  const created: string[] = [];

  const run = <T>(fn: () => Promise<T>) => orm.em.fork().transactional(async (tx) => {
    events = new LibraryEventsService(tx as EntityManager);
    return fn();
  });

  async function newItem(title: string): Promise<string> {
    const id = randomUUID();
    await em.execute(
      `insert into library_items (id, title, category_id, uploaded_by_id, status, created_at, updated_at)
       values (?, ?, ?, ?, 'Published', now(), now())`,
      [id, title, categoryId, userId],
    );
    created.push(id);
    return id;
  }

  beforeAll(async () => {
    orm = await intOrm();
    em = orm.em.fork() as EntityManager;
    const [u] = await em.execute<{ id: string }[]>(`select id from users order by created_at limit 1`);
    const [c] = await em.execute<{ id: string }[]>(`select id from library_categories limit 1`);
    if (!u || !c) throw new Error('Seed the database first (users + library categories)');
    userId = u.id;
    categoryId = c.id;
  });

  afterAll(async () => {
    if (created.length) {
      await em.execute(`delete from library_items where id in (${created.map(() => '?').join(',')})`, created);
    }
    await orm.close(true);
  });

  const count = async (itemId: string) =>
    Number((await em.execute<{ n: number }[]>(`select count(*)::int n from library_events where item_id = ?`, [itemId]))[0]!.n);

  it('a staged event commits with its flush and rolls back with it', async () => {
    const itemId = await newItem('Int: rollback');
    await expect(
      run(async () => {
        events.stage({ action: LibraryEventAction.Edited, viewer: { userId }, itemId, metadata: { fields: ['title'] } });
        await (events as unknown as { em: EntityManager }).em.flush();
        throw new Error('boom after flush');
      }),
    ).rejects.toThrow('boom after flush');
    expect(await count(itemId)).toBe(0);

    await run(async () => {
      events.stage({ action: LibraryEventAction.Edited, viewer: { userId, ip: '10.1.2.3', userAgent: 'jest' }, itemId });
      await (events as unknown as { em: EntityManager }).em.flush();
    });
    expect(await count(itemId)).toBe(1);
  });

  it('is append-only: no deletes, no rewrites — but metadata snapshots and FK set-null are allowed', async () => {
    const title = `Int: append-only ${randomUUID()}`;
    const itemId = await newItem(title);
    await run(() => events.insertNow({ action: LibraryEventAction.Viewed, viewer: { userId }, itemId, metadata: { mode: 'native' } }));
    await expect(em.execute(`delete from library_events where item_id = ?`, [itemId])).rejects.toThrow('append-only');
    await expect(em.execute(`update library_events set action = 'Downloaded' where item_id = ?`, [itemId])).rejects.toThrow(
      'append-only',
    );
    await expect(em.execute(`update library_events set metadata = '{}'::jsonb where item_id = ?`, [itemId])).rejects.toThrow(
      'append-only',
    );

    await run(() => events.snapshotTitle(itemId, title));
    await em.execute(`delete from library_items where id = ?`, [itemId]);
    const rows = await em.execute<{ item_id: string | null; metadata: Record<string, unknown> }[]>(
      `select item_id, metadata from library_events where metadata->>'itemTitle' = ?`,
      [title],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item_id: null, metadata: { mode: 'native', itemTitle: title } });
  });

  it('pages the timeline newest-first with a keyset cursor (no gaps or repeats within the same millisecond)', async () => {
    const itemId = await newItem('Int: cursor');
    await run(async () => {
      for (let i = 0; i < 7; i++) {
        await events.insertNow({ action: LibraryEventAction.Viewed, viewer: { userId }, itemId, metadata: { i } });
      }
    });
    const seen: number[] = [];
    let cursor: string | undefined;
    do {
      const page = await run(() => events.forItem(itemId, { cursor, limit: 3 }));
      seen.push(...page.data.map((e) => Number(e.metadata.i)));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    // All in one transaction ⇒ identical now(); the id tie-breaker keeps the order total.
    expect(seen).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });

  it('the injected (global) EntityManager joins an open em.transactional — as LibraryService.remove relies on', async () => {
    const itemId = await newItem('Int: global em');
    const global = new LibraryEventsService(orm.em as EntityManager);
    await expect(
      orm.em.fork().transactional(async () => {
        await global.insertNow({ action: LibraryEventAction.Deleted, viewer: { userId }, itemId });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await count(itemId)).toBe(0);
  });

  it('uses the (item_id, created_at desc) index for the item timeline', async () => {
    const itemId = await newItem('Int: explain');
    const plan = await orm.em.fork().transactional(async (tx) => {
      await tx.execute('set local enable_seqscan = off');
      return tx.execute<{ 'QUERY PLAN': string }[]>(
        `explain select * from library_events where item_id = ? order by created_at desc, id desc limit 51`,
        [itemId],
      );
    });
    expect(plan.map((r) => r['QUERY PLAN']).join('\n')).toContain('library_events_item_created_idx');
  });
});
