import { randomUUID } from 'node:crypto';
import type { MikroORM } from '@mikro-orm/postgresql';
import { EntityManager } from '@mikro-orm/postgresql';
import { intOrm } from '../../test/int-orm';
import { LibraryAdminService } from './library-admin.service';
import { LibraryEventsService } from './library-events.service';
import type { LibraryViewer } from './library-access';

/** S3 curator queries against real Postgres: needs attention, department impact, transfer-all. */
describe('LibraryAdminService (Postgres)', () => {
  let orm: MikroORM;
  let em: EntityManager;
  let curator: LibraryViewer;
  let categoryId: string;
  let staffRoleId: number;
  let activeStaffId: string;
  const tag = randomUUID().slice(0, 8);
  const cleanup: { users: string[]; items: string[]; depts: number[]; collections: string[] } = {
    users: [],
    items: [],
    depts: [],
    collections: [],
  };

  const svc = () => {
    const fork = orm.em.fork() as EntityManager;
    return new LibraryAdminService(fork, new LibraryEventsService(fork));
  };

  async function user(active: boolean): Promise<string> {
    const id = randomUUID();
    await em.execute(
      `insert into users (id, created_at, updated_at, role_id, first_name, surname, full_name, email, password_hash, is_active)
       values (?, now(), now(), ?, 'Int', ?, ?, ?, 'x', ?)`,
      [id, staffRoleId, tag, `Int ${tag} ${active ? 'active' : 'left'}`, `int-${tag}-${id.slice(0, 4)}@e2e.test`, active],
    );
    cleanup.users.push(id);
    return id;
  }

  async function item(ownerId: string, opts: { departments?: number[]; status?: string } = {}): Promise<string> {
    const id = randomUUID();
    await em.execute(
      `insert into library_items (id, title, category_id, uploaded_by_id, status, visibility, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, now(), now())`,
      [id, `Int ${tag} item`, categoryId, ownerId, opts.status ?? 'Published', opts.departments ? 'Departments' : 'Firm'],
    );
    for (const d of opts.departments ?? []) {
      await em.execute(`insert into library_item_departments (item_id, department_id) values (?, ?)`, [id, d]);
    }
    cleanup.items.push(id);
    return id;
  }

  beforeAll(async () => {
    orm = await intOrm();
    em = orm.em.fork() as EntityManager;
    const [c] = await em.execute<{ id: string }[]>(`select id from library_categories limit 1`);
    const [r] = await em.execute<{ id: number }[]>(`select id from roles where role_name = 'Staff'`);
    const [sa] = await em.execute<{ id: string }[]>(
      `select u.id from users u join roles r on r.id = u.role_id where r.role_name = 'Super Admin' and u.is_active limit 1`,
    );
    categoryId = c!.id;
    staffRoleId = r!.id;
    curator = { userId: sa!.id, departmentId: null, isCurator: true };
    activeStaffId = await user(true);
  });

  afterAll(async () => {
    if (cleanup.items.length) await em.execute(`delete from library_items where id in (${cleanup.items.map(() => '?').join(',')})`, cleanup.items);
    if (cleanup.collections.length) {
      await em.execute(`delete from library_collections where id in (${cleanup.collections.map(() => '?').join(',')})`, cleanup.collections);
    }
    // Events keep their actor; users with events can't be deleted (FK set null is fine, but keep it simple: deactivate).
    for (const u of cleanup.users) await em.execute(`update users set is_active = false where id = ?`, [u]).catch(() => undefined);
    if (cleanup.depts.length) {
      await em.execute(`delete from library_item_departments where department_id in (${cleanup.depts.map(() => '?').join(',')})`, cleanup.depts);
      await em.execute(`delete from departments where id in (${cleanup.depts.map(() => '?').join(',')})`, cleanup.depts);
    }
    await orm.close(true);
  });

  it('department impact counts items restricted to that department only; then it shows as orphaned', async () => {
    const newDept = async (name: string) =>
      (await em.execute<{ id: number }[]>(`insert into departments (name, is_active) values (?, true) returning id`, [name]))[0]!.id;
    const dept = await newDept(`Int dept ${tag}`);
    const other = await newDept(`Int dept2 ${tag}`);
    cleanup.depts.push(dept, other);
    const only = await item(activeStaffId, { departments: [dept] });
    await item(activeStaffId, { departments: [dept, other] }); // still has an active department after
    await expect(svc().departmentImpact(dept, curator)).resolves.toEqual({ items: 1, collections: 0 });

    await em.execute(`update departments set is_active = false where id = ?`, [dept]);
    const attention = await svc().attention(curator);
    expect(attention.orphanedRestricted.map((i) => i.id)).toContain(only);
    expect(attention.orphanedRestricted.find((i) => i.id === only)?.departments).toEqual([`Int dept ${tag}`]);
  });

  it('lists deactivated owners and transfers everything they own in one go (logged)', async () => {
    const leaver = await user(false);
    const a = await item(leaver);
    const b = await item(leaver, { status: 'Archived' });
    const before = await svc().attention(curator);
    expect(before.ownerDeactivated.find((o) => o.id === leaver)).toMatchObject({ items: 2, collections: 0 });

    await expect(svc().transferAll(leaver, activeStaffId, curator)).resolves.toEqual({ items: 2, collections: 0 });
    const owners = await em.execute<{ uploaded_by_id: string }[]>(
      `select uploaded_by_id from library_items where id in (?, ?)`,
      [a, b],
    );
    expect(owners.every((o) => o.uploaded_by_id === activeStaffId)).toBe(true);
    const events = await em.execute<{ n: number }[]>(
      `select count(*)::int n from library_events where action = 'OwnershipTransferred' and item_id in (?, ?)`,
      [a, b],
    );
    expect(Number(events[0]!.n)).toBe(2);
    const after = await svc().attention(curator);
    expect(after.ownerDeactivated.find((o) => o.id === leaver)).toBeUndefined();
  });

  it('quarantined items and scan errors are listed for curators', async () => {
    const q = await item(activeStaffId, { status: 'Quarantined' });
    await em.execute(`update library_items set scan_status = 'Infected', scan_error = 'Eicar-Test-Signature' where id = ?`, [q]);
    const e = await item(activeStaffId);
    await em.execute(`update library_items set scan_status = 'Error', scan_error = 'clamd timed out' where id = ?`, [e]);
    const a = await svc().attention(curator);
    expect(a.quarantined.find((i) => i.id === q)?.detail).toBe('Eicar-Test-Signature');
    expect(a.scanErrors.find((i) => i.id === e)?.detail).toBe('clamd timed out');
  });
});
