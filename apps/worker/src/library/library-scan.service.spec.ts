import { LibraryScanService, MAX_SCAN_ATTEMPTS, quarantineKey } from './library-scan.service';

type Call = { sql: string; params: unknown[] };

function setup(row: Record<string, unknown> | null, result: unknown) {
  const calls: Call[] = [];
  const conn = {
    execute: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.trim().startsWith('select id, title')) return row ? [row] : [];
      if (sql.includes('from users u')) return [
        { id: 'u-up', email: 'up@e2e.test', is_uploader: true, in_app: null, email_on: null },
        { id: 'u-sa', email: 'sa@e2e.test', is_uploader: false, in_app: null, email_on: false },
      ];
      return [];
    }),
  };
  const em = { getConnection: () => conn };
  const config = { get: (k: string, d?: unknown) => ({ STORAGE_DRIVER: 'local' } as Record<string, unknown>)[k] ?? d };
  class TestScan extends LibraryScanService {
    moved: string[] = [];
    protected override async scanObject() {
      if (result instanceof Error) throw result;
      return result as never;
    }
    // Don't touch the filesystem in unit tests.
    protected override async moveToQuarantine(key: string) {
      this.moved.push(key);
      return `quarantine/${key}`;
    }
  }
  const service = new TestScan(config as never);
  return { service, calls, em };
}

const row = {
  id: 'item-1',
  title: 'Deck',
  file_name: 'deck.pdf',
  storage_key: 'library/item-1/a.pdf',
  preview_storage_key: null,
  scan_status: 'Pending',
  scan_attempts: 0,
  uploaded_by_id: 'u-up',
};
const clean = { infected: false, signature: null, sha256: 'a'.repeat(64), bytes: 10, head: Buffer.alloc(0), scanned: true };

describe('quarantineKey', () => {
  it('keeps the bucket prefix first', () => {
    expect(quarantineKey('abdcshare/library/x/a.pdf', 'abdcshare')).toBe('abdcshare/quarantine/library/x/a.pdf');
    expect(quarantineKey('library/x/a.pdf', null)).toBe('quarantine/library/x/a.pdf');
  });
});

describe('LibraryScanService state transitions', () => {
  it('Pending → Clean with the hash', async () => {
    const { service, calls, em } = setup(row, clean);
    await service.scan({ itemId: 'item-1', storageKey: row.storage_key }, em as never);
    const update = calls.find((c) => c.sql.includes("scan_status = 'Clean'"))!;
    expect(update.params).toEqual(['a'.repeat(64), null, 'item-1', row.storage_key]);
  });

  it('skips stale jobs (file replaced since) and decided items', async () => {
    const a = setup(row, clean);
    await a.service.scan({ itemId: 'item-1', storageKey: 'library/item-1/old.pdf' }, a.em as never);
    expect(a.calls).toHaveLength(1);
    const b = setup({ ...row, scan_status: 'Clean' }, clean);
    await b.service.scan({ itemId: 'item-1', storageKey: row.storage_key }, b.em as never);
    expect(b.calls).toHaveLength(1);
  });

  it('retries errors through the queue, then parks the item as Error', async () => {
    const first = setup(row, new Error('clamd timed out'));
    await expect(first.service.scan({ itemId: 'item-1', storageKey: row.storage_key }, first.em as never)).rejects.toThrow('timed out');
    expect(first.calls[1]!.params.slice(0, 3)).toEqual([1, 'clamd timed out', 'Pending']);

    const last = setup({ ...row, scan_attempts: MAX_SCAN_ATTEMPTS - 1 }, new Error('clamd timed out'));
    await expect(last.service.scan({ itemId: 'item-1', storageKey: row.storage_key }, last.em as never)).resolves.toBeUndefined();
    expect(last.calls[1]!.params.slice(0, 3)).toEqual([MAX_SCAN_ATTEMPTS, 'clamd timed out', 'Error']);
  });

  it('Infected → Quarantined: object moved, event logged, uploader + curators told (preferences respected)', async () => {
    const { service, calls, em } = setup(row, { ...clean, infected: true, signature: 'Eicar-Test-Signature' });
    await service.scan({ itemId: 'item-1', storageKey: row.storage_key }, em as never);
    expect((service as unknown as { moved: string[] }).moved).toEqual([row.storage_key]);
    const update = calls.find((c) => c.sql.includes("status = 'Quarantined'"))!;
    expect(update.params).toEqual(['a'.repeat(64), 'Eicar-Test-Signature', `quarantine/${row.storage_key}`, 'item-1']);
    expect(calls.some((c) => c.sql.includes("'Quarantined', ?") && c.sql.includes('library_events'))).toBe(true);
    const notes = calls.filter((c) => c.sql.includes('insert into notifications'));
    expect(notes.map((n) => n.params[1])).toEqual(['u-up', 'u-sa']);
    const outbox = calls.find((c) => c.sql.includes('insert into outbox'))!;
    const emails = JSON.parse(String(outbox.params[1])).emails;
    expect(emails.map((e: { to: string }) => e.to)).toEqual(['up@e2e.test']); // SA turned email off
  });
});
