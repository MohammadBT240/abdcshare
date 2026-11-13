import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { LibraryCollectionExportService } from './library-collection-export.service';

type Row = {
  item_id: string;
  title: string;
  file_name: string;
  storage_key: string;
  authors: string | null;
  published_year: number | null;
  section: string | null;
  position: number;
  downloadable: boolean;
  scan_status: string;
};

async function setup(rows: Row[], collection: { title: string } | null = { title: 'IFRS 17 workshop' }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'zip-spec-'));
  for (const r of rows) {
    await mkdir(path.dirname(path.join(dir, r.storage_key)), { recursive: true });
    await writeFile(path.join(dir, r.storage_key), `content of ${r.title}`);
  }
  const calls: { sql: string; params: unknown[] }[] = [];
  const conn = {
    execute: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('from library_collections')) return collection ? [collection] : [];
      if (sql.includes('from library_collection_items')) return rows;
      return [];
    }),
  };
  const config = { get: (k: string, d?: unknown) => ({ STORAGE_DRIVER: 'local', LOCAL_STORAGE_DIR: dir } as Record<string, unknown>)[k] ?? d };
  return { service: new LibraryCollectionExportService(config as never), em: { getConnection: () => conn }, calls, dir };
}

const row = (n: number, extra: Partial<Row> = {}): Row => ({
  item_id: `item-${n}`,
  title: `Deck ${n}`,
  file_name: `deck-${n}.pdf`,
  storage_key: `library/item-${n}/deck-${n}.pdf`,
  authors: null,
  published_year: 2026,
  section: null,
  position: n,
  downloadable: true,
  scan_status: 'Clean',
  ...extra,
});

async function zipOf(dir: string): Promise<JSZip> {
  const base = path.join(dir, 'exports/library-collections/col-1');
  const [file] = await readdir(base);
  return JSZip.loadAsync(await readFile(path.join(base, file!)));
}

describe('LibraryCollectionExportService', () => {
  it('zips files in order with section folders and an index, then notifies the requester', async () => {
    const { service, em, calls, dir } = await setup([row(1, { section: 'Day 1' }), row(2, { section: 'Day 1' }), row(3)]);
    await service.export({ collectionId: 'col-1', actorUserId: 'u1', itemIds: ['item-1', 'item-2', 'item-3'] }, em as never);
    const zip = await zipOf(dir);
    expect(Object.keys(zip.files).filter((f) => !f.endsWith('/')).sort()).toEqual(['3 - Deck 3.pdf', 'Day 1/1 - Deck 1.pdf', 'Day 1/2 - Deck 2.pdf', 'index.csv'].sort());
    expect(await zip.file('Day 1/1 - Deck 1.pdf')!.async('string')).toBe('content of Deck 1');
    const note = calls.find((c) => c.sql.includes('insert into notifications'))!;
    expect(note.params).toEqual(expect.arrayContaining(['u1', 'library.export_ready', 'library_collection', 'col-1']));
  });

  it('skips view-only and unscanned files (unless the requester may edit them) and lists them in index.csv', async () => {
    const { service, em, calls, dir } = await setup([
      row(1),
      row(2, { downloadable: false }),
      row(3, { downloadable: false }),
      row(4, { scan_status: 'Pending' }),
    ]);
    await service.export(
      { collectionId: 'col-1', actorUserId: 'u1', itemIds: ['item-1', 'item-3'], viewOnlyItemIds: ['item-2', 'item-4'], editorItemIds: ['item-3'] },
      em as never,
    );
    const zip = await zipOf(dir);
    expect(Object.keys(zip.files).filter((f) => f.endsWith('.pdf')).sort()).toEqual(['1 - Deck 1.pdf', '2 - Deck 3.pdf']);
    const index = await zip.file('index.csv')!.async('string');
    expect(index).toContain('"Deck 2"');
    expect(index).toContain('View-only: open it in the library');
    expect(index).toContain('Not included yet (virus check pending)');
    const note = calls.find((c) => c.sql.includes('insert into notifications'))!;
    expect(String(note.params[6])).toContain('2 view-only or unchecked item(s)');
  });

  it('a collection deleted before the job ran is skipped, not failed', async () => {
    const { service, em } = await setup([row(1)], null);
    await expect(service.export({ collectionId: 'col-1', actorUserId: 'u1', itemIds: ['item-1'] }, em as never)).resolves.toBeUndefined();
  });

  it('fails when nothing can be zipped (so the job shows on the jobs page)', async () => {
    const { service, em } = await setup([row(1, { downloadable: false })]);
    await expect(
      service.export({ collectionId: 'col-1', actorUserId: 'u1', itemIds: ['item-1'] }, em as never),
    ).rejects.toThrow('No files to export');
  });

  it('makes names safe for every OS', () => {
    const name = `a/b${String.fromCharCode(92)}c:d*e?"f<g>h|i${String.fromCharCode(1)}j`;
    expect(LibraryCollectionExportService.safe(name)).toBe('a_b_c_d_e__f_g_h_i_j');
    expect(LibraryCollectionExportService.safe('   ')).toBe('item');
  });
});
