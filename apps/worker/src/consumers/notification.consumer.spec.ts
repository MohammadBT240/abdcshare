import { EVENT, OutboxStatus } from '@abdcshare/shared';
import { NotificationDeliveryEntity } from '@abdcshare/persistence';
import { NotificationConsumer } from './notification.consumer';

type Row = { id: string; status: OutboxStatus; processedAt?: Date | null; lastError?: string | null; updatedAt?: Date };

function setup(row: Row | null) {
  const em = {
    findOne: jest.fn(async () => row),
    flush: jest.fn(async () => undefined),
    nativeUpdate: jest.fn(async () => 1),
  };
  const orm = { em: { fork: () => em } };
  const email = { sendReact: jest.fn(async () => undefined) };
  const fn = () => jest.fn(async (..._a: unknown[]) => undefined);
  const exports_ = { export: fn() };
  const previews = { generate: fn() };
  const submissions = { export: fn() };
  const library = { export: fn() };
  const scans = { scan: fn() };
  const config = { get: (_k: string, d?: unknown) => d };
  const consumer = new NotificationConsumer(
    config as never,
    orm as never,
    email as never,
    exports_ as never,
    previews as never,
    submissions as never,
    library as never,
    scans as never,
  );
  const handle = (eventType: string, payload: Record<string, unknown> = {}) =>
    (consumer as unknown as { handle(j: unknown): Promise<void> }).handle({ data: { outboxId: 'o1', eventType, payload } });
  return { consumer, handle, em, email, previews, library, scans };
}

describe('NotificationConsumer', () => {
  it('routes each event to its handler and seals the row Sent', async () => {
    const row: Row = { id: 'o1', status: OutboxStatus.Queued };
    const { handle, scans, em } = setup(row);
    await handle(EVENT.LibraryScanRequested, { itemId: 'i', storageKey: 'k' });
    expect(scans.scan).toHaveBeenCalledWith({ itemId: 'i', storageKey: 'k' }, em);
    expect(row.status).toBe(OutboxStatus.Sent);
    expect(row.processedAt).toBeInstanceOf(Date);
    expect(em.flush).toHaveBeenCalled();

    const r2: Row = { id: 'o1', status: OutboxStatus.Queued };
    const b = setup(r2);
    await b.handle(EVENT.LibraryCollectionExportRequested, { collectionId: 'c' });
    expect(b.library.export).toHaveBeenCalled();
    const r3: Row = { id: 'o1', status: OutboxStatus.Queued };
    const c = setup(r3);
    await c.handle(EVENT.FilePreviewRequested, { fileId: 'f' });
    expect(c.previews.generate).toHaveBeenCalled();
  });

  it('is idempotent: a Sent or missing row is skipped', async () => {
    const sent = setup({ id: 'o1', status: OutboxStatus.Sent });
    await sent.handle(EVENT.LibraryScanRequested);
    expect(sent.scans.scan).not.toHaveBeenCalled();
    const missing = setup(null);
    await missing.handle(EVENT.LibraryScanRequested);
    expect(missing.scans.scan).not.toHaveBeenCalled();
  });

  it('records the error, marks the row Failed and rethrows so the queue retries', async () => {
    const row: Row = { id: 'o1', status: OutboxStatus.Queued };
    const { handle, scans, em } = setup(row);
    scans.scan.mockRejectedValueOnce(new Error('clamd timed out'));
    await expect(handle(EVENT.LibraryScanRequested)).rejects.toThrow('clamd timed out');
    expect(row).toMatchObject({ status: OutboxStatus.Failed, lastError: 'clamd timed out' });
    expect(em.flush).toHaveBeenCalled();
  });

  it('sends notification emails and marks each notification as emailed via the shared entity', async () => {
    const row: Row = { id: 'o1', status: OutboxStatus.Queued };
    const { handle, email, em } = setup(row);
    await handle(EVENT.NotificationEmail, {
      emails: [
        { notificationId: 'n1', to: 'a@e2e.test', subject: 'Hi', body: 'Body', link: '/library' },
        { to: 'b@e2e.test', subject: 'No row' },
        { to: '', subject: 'skipped' },
      ],
    });
    expect(email.sendReact).toHaveBeenCalledTimes(2);
    expect(em.nativeUpdate).toHaveBeenCalledTimes(1);
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      NotificationDeliveryEntity,
      { id: 'n1' },
      expect.objectContaining({ emailSent: true }),
    );
  });

  it('unknown events are sealed without side effects', async () => {
    const row: Row = { id: 'o1', status: OutboxStatus.Queued };
    const { handle, email } = setup(row);
    await handle('something.else');
    expect(email.sendReact).not.toHaveBeenCalled();
    expect(row.status).toBe(OutboxStatus.Sent);
  });
});
