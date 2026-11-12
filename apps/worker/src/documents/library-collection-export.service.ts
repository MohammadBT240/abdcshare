import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

interface Row {
  item_id: string;
  title: string;
  file_name: string;
  storage_key: string;
  authors: string | null;
  published_year: number | null;
  section: string | null;
  position: number;
  downloadable: boolean;
}

/**
 * Builds a ZIP of a library collection (S1, D13). The API resolves which items the requester may
 * see and passes their ids; the worker never widens that list. The archive is streamed to a temp
 * file (not held in memory), uploaded, and the requester gets a notification with a download link.
 */
@Injectable()
export class LibraryCollectionExportService {
  constructor(private readonly config: ConfigService) {}

  private local(): boolean {
    return this.config.get('STORAGE_DRIVER', 'local') === 'local';
  }

  private localPath(key: string): string {
    const root = path.resolve(this.config.get<string>('LOCAL_STORAGE_DIR', '../api/storage'));
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  private r2(): S3Client {
    return new S3Client({
      region: 'auto',
      endpoint: this.config.get<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  private async open(key: string): Promise<Readable> {
    if (this.local()) return createReadStream(this.localPath(key));
    const res = await this.r2().send(new GetObjectCommand({ Bucket: this.config.get<string>('R2_BUCKET')!, Key: key }));
    if (!res.Body) throw new Error(`Storage object is empty: ${key}`);
    return res.Body as Readable;
  }

  static safe(value: string, fallback = 'item'): string {
    const printable = Array.from(value, (ch) => (ch.charCodeAt(0) < 0x20 ? '_' : ch)).join('');
    return printable.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150) || fallback;
  }

  static csv(rows: (string | number | null)[][]): string {
    return rows
      .map((r) => r.map((v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`)).join(','))
      .join('\r\n');
  }

  async export(payload: Record<string, unknown>, em: EntityManager): Promise<void> {
    const collectionId = String(payload.collectionId ?? '');
    const actorUserId = String(payload.actorUserId ?? '');
    const itemIds = Array.isArray(payload.itemIds) ? payload.itemIds.map(String) : [];
    // View-only items (S2, D22) are listed in index.csv but never zipped — unless the requester may edit them.
    const viewOnlyIds = Array.isArray(payload.viewOnlyItemIds) ? payload.viewOnlyItemIds.map(String) : [];
    const editorIds = new Set(Array.isArray(payload.editorItemIds) ? payload.editorItemIds.map(String) : []);
    if (!collectionId || !actorUserId || itemIds.length === 0) throw new Error('Invalid collection export payload');

    const conn = em.getConnection();
    const [collection] = await conn.execute<{ title: string }[]>(`select title from library_collections where id = ?`, [collectionId]);
    if (!collection) throw new Error('Collection not found');
    const rows = await conn.execute<Row[]>(
      `select i.id as item_id, i.title, i.file_name, i.storage_key, i.authors, i.published_year, ci.section, ci.position,
              i.downloadable
         from library_collection_items ci join library_items i on i.id = ci.item_id
        where ci.collection_id = ? and i.id in (${[...itemIds, ...viewOnlyIds].map(() => '?').join(', ')})
          and i.storage_key is not null
        order by ci.position asc`,
      [collectionId, ...itemIds, ...viewOnlyIds],
    );
    // Re-check at build time: an item made view-only after the request is skipped too.
    const zipped = rows.filter((r) => itemIds.includes(r.item_id) && (r.downloadable || editorIds.has(r.item_id)));
    const skipped = rows.filter((r) => !zipped.includes(r));
    if (zipped.length === 0) throw new Error('No files to export');

    const dir = await mkdtemp(path.join(tmpdir(), 'libzip-'));
    const zipPath = path.join(dir, 'export.zip');
    try {
      const archive = archiver('zip', { zlib: { level: 6 } });
      const done = pipeline(archive, createWriteStream(zipPath));
      const width = String(zipped.length).length;
      const index: (string | number | null)[][] = [['#', 'Section', 'Title', 'Authors', 'Year', 'File in archive']];
      const used = new Set<string>();
      // One source stream at a time: wait for archiver to finish each entry before opening the next.
      for (const [i, r] of zipped.entries()) {
        const ext = path.extname(r.file_name);
        const folder = r.section ? `${LibraryCollectionExportService.safe(r.section, 'section')}/` : '';
        let name = `${folder}${String(i + 1).padStart(width, '0')} - ${LibraryCollectionExportService.safe(r.title)}${ext}`;
        if (used.has(name)) name = name.replace(ext, ` (${r.item_id.slice(0, 8)})${ext}`);
        used.add(name);
        index.push([i + 1, r.section, r.title, r.authors, r.published_year, name]);
        const entryDone = new Promise<void>((resolve) => archive.once('entry', () => resolve()));
        archive.append(await this.open(r.storage_key), { name });
        await entryDone;
      }
      for (const r of skipped) {
        index.push(['', r.section, r.title, r.authors, r.published_year, 'View-only: open it in the library']);
      }
      archive.append(LibraryCollectionExportService.csv(index), { name: 'index.csv' });
      await archive.finalize();
      await done;

      const fileName = `${LibraryCollectionExportService.safe(collection.title, 'collection')}.zip`;
      const prefix = this.local() ? '' : `${this.config.get('R2_OBJECT_PREFIX', 'abdcshare')}/`;
      const storageKey = `${prefix}exports/library-collections/${collectionId}/${randomUUID()}.zip`;
      if (this.local()) {
        const dest = this.localPath(storageKey);
        await mkdir(path.dirname(dest), { recursive: true });
        await pipeline(createReadStream(zipPath), createWriteStream(dest));
      } else {
        const { size } = await stat(zipPath);
        await this.r2().send(
          new PutObjectCommand({
            Bucket: this.config.get<string>('R2_BUCKET')!,
            Key: storageKey,
            Body: createReadStream(zipPath),
            ContentLength: size,
            ContentType: 'application/zip',
          }),
        );
      }

      const link =
        `/api/bff/proxy/library/collections/${collectionId}/exports/download` +
        `?key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(fileName)}`;
      const now = new Date();
      await conn.execute(
        `insert into notifications
           (id, created_at, updated_at, user_id, type, title, body, entity_type, entity_id, link, is_read, email_sent)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, false)`,
        [
          randomUUID(),
          now,
          now,
          actorUserId,
          'library.export_ready',
          'Collection download ready',
          `${zipped.length} file(s) from “${collection.title}” are ready to download` +
            (skipped.length ? ` (${skipped.length} view-only item(s) listed in index.csv)` : ''),
          'library_collection',
          collectionId,
          link,
        ],
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
