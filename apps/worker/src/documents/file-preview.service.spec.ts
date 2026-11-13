import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FilePreviewService } from './file-preview.service';

/** The real-conversion test runs only where LibreOffice is installed (the worker image, dev boxes). */
const HAS_SOFFICE = spawnSync('soffice', ['--version'], { timeout: 30_000 }).status === 0;

const FIXTURES = path.join(__dirname, '..', '..', '..', '..', 'e2e', 'fixtures', 'files');

async function setup(row: Record<string, unknown> | undefined) {
  const dir = await mkdtemp(path.join(tmpdir(), 'preview-spec-'));
  const calls: { sql: string; params: unknown[] }[] = [];
  const conn = {
    execute: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return sql.trim().startsWith('select') ? (row ? [row] : []) : [];
    }),
  };
  const em = { getConnection: () => conn };
  const config = {
    get: (k: string, d?: unknown) => ({ STORAGE_DRIVER: 'local', LOCAL_STORAGE_DIR: dir } as Record<string, unknown>)[k] ?? d,
  };
  return { service: new FilePreviewService(config as never), em, calls, dir };
}

describe('FilePreviewService', () => {
  it('maps entity types to tables and refuses unknown ones', async () => {
    const { service, em } = await setup({ preview_status: 'Pending', preview_storage_key: null });
    await expect(
      service.generate({ entityType: 'nope', fileId: 'f', storageKey: 'k' }, em as never),
    ).rejects.toThrow('Unsupported entityType nope');
  });

  it('library items: only writes to the row that still points at the converted file (stale-job guard)', async () => {
    const { service, em, calls, dir } = await setup({ preview_status: 'Pending', preview_storage_key: null });
    await mkdir(path.join(dir, 'library/item-1'), { recursive: true });
    await writeFile(path.join(dir, 'library/item-1/locked.docx'), await readFile(path.join(FIXTURES, 'protected.docx')));
    await service.generate(
      { entityType: 'library_item', fileId: 'item-1', storageKey: 'library/item-1/locked.docx', fileName: 'locked.docx' },
      em as never,
    );
    const update = calls.find((c) => c.sql.includes("preview_status = 'Failed'"))!;
    expect(update.sql).toContain('and storage_key = ?');
    expect(update.sql).toContain('preview_error_code = ?');
    expect(update.params).toEqual(['The document is password-protected', 'password_protected', 'item-1', 'library/item-1/locked.docx']);
  });

  it('other tables get no storage-key guard and no error code column', async () => {
    const { service, em, calls, dir } = await setup({ preview_status: 'Pending', preview_storage_key: null });
    await writeFile(path.join(dir, 'locked.docx'), await readFile(path.join(FIXTURES, 'protected.docx')));
    await service.generate({ entityType: 'document_file', fileId: 'd1', storageKey: 'locked.docx', fileName: 'locked.docx' }, em as never);
    const update = calls.find((c) => c.sql.includes("preview_status = 'Failed'"))!;
    expect(update.sql).not.toContain('storage_key = ?');
    expect(update.sql).not.toContain('preview_error_code');
  });

  it('skips Ready and permanently Failed rows (no retries burned)', async () => {
    for (const status of ['Ready', 'Failed']) {
      const { service, em, calls } = await setup({ preview_status: status, preview_storage_key: status === 'Ready' ? 'p' : null });
      await service.generate({ entityType: 'library_item', fileId: 'i', storageKey: 'k', fileName: 'x.docx' }, em as never);
      expect(calls).toHaveLength(1);
    }
  });

  (HAS_SOFFICE ? it : it.skip)('converts a real .docx with LibreOffice and stores the preview', async () => {
    const { service, em, calls, dir } = await setup({ preview_status: 'Pending', preview_storage_key: null });
    await writeFile(path.join(dir, 'sample.docx'), await readFile(path.join(FIXTURES, 'sample.docx')));
    await service.generate({ entityType: 'library_item', fileId: 'i', storageKey: 'sample.docx', fileName: 'sample.docx' }, em as never);
    const ready = calls.find((c) => c.sql.includes("preview_status = 'Ready'"))!;
    expect(String(ready.params[0])).toMatch(/^previews\/.+sample\.pdf$/);
    expect((await readdir(path.join(dir, 'previews'))).length).toBe(1);
  }, 120_000);
});
