import type { MikroORM } from '@mikro-orm/postgresql';
import { EntityManager } from '@mikro-orm/postgresql';
import { intOrm } from '../../test/int-orm';
import { LibraryReportsService } from './library-reports.service';

/** Curator recipients resolved against the real users/roles tables (a mocked EM can't catch a bad property path). */
describe('LibraryReportsService (Postgres)', () => {
  let orm: MikroORM;
  beforeAll(async () => {
    orm = await intOrm();
  });
  afterAll(async () => orm.close(true));

  it('notifies every active Super Admin / Platform Admin', async () => {
    const em = orm.em.fork() as EntityManager;
    const service = new LibraryReportsService(em, {} as never, {} as never, {} as never);
    const recipients = await (service as unknown as { curatorRecipients(): Promise<{ userId: string }[]> }).curatorRecipients();
    const expected = await em.execute<{ id: string }[]>(
      `select u.id from users u join roles r on r.id = u.role_id
        where u.is_active and r.role_name in ('Super Admin', 'Platform Admin')`,
    );
    expect(recipients.map((r) => r.userId).sort()).toEqual(expected.map((r) => r.id).sort());
    expect(recipients.length).toBeGreaterThan(0);
  });
});
