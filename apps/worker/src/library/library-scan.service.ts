import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from '@mikro-orm/postgresql';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { hashStream, scanStream, type ScanResult } from './clamd-client';

/** Scan failures before an item is parked as `Error` for curators (D24). */
export const MAX_SCAN_ATTEMPTS = 3;

interface ItemRow {
  id: string;
  title: string;
  file_name: string | null;
  storage_key: string | null;
  preview_storage_key: string | null;
  scan_status: string;
  scan_attempts: number;
  uploaded_by_id: string;
}

/** Key under the bucket's object prefix: `abdcshare/library/x` → `abdcshare/quarantine/library/x`. */
export function quarantineKey(key: string, objectPrefix: string | null): string {
  if (objectPrefix && key.startsWith(`${objectPrefix}/`)) {
    return `${objectPrefix}/quarantine/${key.slice(objectPrefix.length + 1)}`;
  }
  return `quarantine/${key}`;
}

/**
 * Virus scan for library uploads (S3, D24/D27): streams the object to clamd (INSTREAM) while
 * hashing it, then marks the item Clean — or quarantines it: status Quarantined, the object
 * moved under `quarantine/`, its preview deleted, curators + uploader notified, event logged.
 * Errors are retried by the queue's backoff; after {@link MAX_SCAN_ATTEMPTS} the item is `Error`.
 *
 * Without CLAMD_HOST (development only — production refuses to boot) files are hashed and marked
 * Clean with a "not scanned" note so local downloads keep working.
 */
@Injectable()
export class LibraryScanService {
  private readonly logger = new Logger(LibraryScanService.name);

  constructor(private readonly config: ConfigService) {}

  private local(): boolean {
    return this.config.get('STORAGE_DRIVER', 'local') === 'local';
  }

  private localPath(key: string): string {
    return path.join(this.config.get<string>('LOCAL_STORAGE_DIR', '../api/storage'), key);
  }

  private r2(): S3Client {
    return new S3Client({
      region: 'auto',
      endpoint: this.config.get<string>('R2_ENDPOINT')!,
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

  /** Overridable in tests. */
  protected async scanObject(key: string): Promise<ScanResult & { scanned: boolean }> {
    const host = this.config.get<string>('CLAMD_HOST');
    const source = await this.open(key);
    if (!host) {
      const h = await hashStream(source);
      return { ...h, infected: false, signature: null, scanned: false };
    }
    const port = Number(this.config.get('CLAMD_PORT', 3310));
    return { ...(await scanStream(source, { host, port })), scanned: true };
  }

  /** Protected so unit tests can stub storage. */
  protected async moveToQuarantine(key: string): Promise<string> {
    const prefix = this.local() ? null : this.config.get<string>('R2_OBJECT_PREFIX', 'abdcshare');
    const dest = quarantineKey(key, prefix);
    if (this.local()) {
      await mkdir(path.dirname(this.localPath(dest)), { recursive: true });
      await rename(this.localPath(key), this.localPath(dest));
    } else {
      const Bucket = this.config.get<string>('R2_BUCKET')!;
      await this.r2().send(new CopyObjectCommand({ Bucket, Key: dest, CopySource: `${Bucket}/${encodeURI(key)}` }));
      await this.r2().send(new DeleteObjectCommand({ Bucket, Key: key }));
    }
    return dest;
  }

  private async deleteObject(key: string): Promise<void> {
    try {
      if (this.local()) await rm(this.localPath(key), { force: true });
      else await this.r2().send(new DeleteObjectCommand({ Bucket: this.config.get<string>('R2_BUCKET')!, Key: key }));
    } catch (err) {
      this.logger.warn(`Could not delete ${key}: ${String(err)}`);
    }
  }

  async scan(payload: Record<string, unknown>, em: EntityManager): Promise<void> {
    const itemId = String(payload.itemId ?? '');
    const storageKey = String(payload.storageKey ?? '');
    if (!itemId || !storageKey) throw new Error('Invalid library scan payload');
    const conn = em.getConnection();
    const [row] = await conn.execute<ItemRow[]>(
      `select id, title, file_name, storage_key, preview_storage_key, scan_status, scan_attempts, uploaded_by_id
         from library_items where id = ?`,
      [itemId],
    );
    // Gone, replaced since (a newer job scans the new file), or already decided.
    if (!row || row.storage_key !== storageKey || row.scan_status === 'Clean' || row.scan_status === 'Infected') return;

    let result: Awaited<ReturnType<LibraryScanService['scanObject']>>;
    try {
      result = await this.scanObject(storageKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = Number(row.scan_attempts) + 1;
      const final = attempts >= MAX_SCAN_ATTEMPTS;
      await conn.execute(
        `update library_items set scan_attempts = ?, scan_error = ?, scan_status = ? where id = ? and storage_key = ?`,
        [attempts, message.slice(0, 2000), final ? 'Error' : 'Pending', itemId, storageKey],
      );
      this.logger.error(`Scan ${final ? 'gave up' : 'failed'} for library item ${itemId} (attempt ${attempts}): ${message}`);
      if (!final) throw err; // the queue retries with exponential backoff
      return;
    }

    if (!result.infected) {
      await conn.execute(
        `update library_items
            set scan_status = 'Clean', scanned_at = now(), content_hash = ?, scan_error = ?, scan_attempts = scan_attempts + 1
          where id = ? and storage_key = ?`,
        [result.sha256, result.scanned ? null : 'Not scanned: CLAMD_HOST is not set (development)', itemId, storageKey],
      );
      return;
    }

    // Infected → quarantine.
    const dest = await this.moveToQuarantine(storageKey);
    if (row.preview_storage_key) await this.deleteObject(row.preview_storage_key);
    await conn.execute(
      `update library_items
          set status = 'Quarantined', scan_status = 'Infected', scanned_at = now(), content_hash = ?,
              scan_error = ?, storage_key = ?, preview_storage_key = null, preview_status = 'None',
              scan_attempts = scan_attempts + 1
        where id = ?`,
      [result.sha256, result.signature, dest, itemId],
    );
    await conn.execute(
      `insert into library_events (item_id, actor_id, action, metadata, created_at) values (?, null, 'Quarantined', ?, now())`,
      [itemId, JSON.stringify({ signature: result.signature, fileName: row.file_name })],
    );
    await this.notify(conn, row, result.signature ?? 'malware');
    this.logger.warn(`Quarantined library item ${itemId}: ${result.signature}`);
  }

  /** In-app rows + one email job (sent by this worker via the outbox), respecting preferences. */
  private async notify(
    conn: ReturnType<EntityManager['getConnection']>,
    row: ItemRow,
    signature: string,
  ): Promise<void> {
    const type = 'library.quarantined';
    const recipients = await conn.execute<
      { id: string; email: string | null; is_uploader: boolean; in_app: boolean | null; email_on: boolean | null }[]
    >(
      `select u.id, u.email, (u.id = ?) as is_uploader, p.in_app_enabled as in_app, p.email_enabled as email_on
         from users u
         join roles r on r.id = u.role_id
         left join notification_preferences p on p.user_id = u.id and p.notification_type = ?
        where u.is_active and (u.id = ? or r.role_name in ('Super Admin', 'Platform Admin'))`,
      [row.uploaded_by_id, type, row.uploaded_by_id],
    );
    const emails: { notificationId?: string; to: string; subject: string; body: string; link?: string }[] = [];
    for (const r of recipients) {
      const title = r.is_uploader
        ? `Your upload “${row.title}” was quarantined`
        : `Library file quarantined: ${row.title}`;
      const body = r.is_uploader
        ? `The virus scan found a threat (${signature}) in ${row.file_name ?? 'the file'}. It has been removed from the library and a curator has been told.`
        : `The virus scan found ${signature} in ${row.file_name ?? 'the file'}. The item is hidden and the file moved to quarantine.`;
      const link = r.is_uploader ? '/library?scope=mine' : '/library/review?tab=attention';
      let notificationId: string | undefined;
      if (r.in_app !== false) {
        notificationId = randomUUID();
        await conn.execute(
          `insert into notifications (id, created_at, updated_at, user_id, type, title, body, entity_type, entity_id, link, is_read, email_sent)
           values (?, now(), now(), ?, ?, ?, ?, 'library_item', ?, ?, false, false)`,
          [notificationId, r.id, type, title, body, row.id, link],
        );
      }
      if (r.email && r.email_on !== false) emails.push({ notificationId, to: r.email, subject: title, body, link });
    }
    if (emails.length) {
      await conn.execute(
        `insert into outbox (id, created_at, updated_at, event_type, payload, status) values (?, now(), now(), 'notification.email', ?, 'Pending')`,
        [randomUUID(), JSON.stringify({ emails })],
      );
    }
  }
}
