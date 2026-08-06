import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';

interface ExportFileRow {
  storageKey: string;
  fileName: string;
  documentTitle: string;
}

@Injectable()
export class DocumentExportService {
  constructor(private readonly config: ConfigService) {}

  async export(
    payload: Record<string, unknown>,
    em: EntityManager,
  ): Promise<void> {
    const engagementId = String(payload.engagementId ?? '');
    const actorUserId = String(payload.actorUserId ?? '');
    const requestClassId =
      typeof payload.requestClassId === 'number' ? payload.requestClassId : null;
    const category = typeof payload.category === 'string' ? payload.category : null;
    if (!engagementId || !actorUserId) throw new Error('Invalid document export payload');

    const rows = await em.getConnection().execute<ExportFileRow[]>(
      `select distinct on (d.id)
         df.storage_key as "storageKey",
         df.file_name as "fileName",
         d.title as "documentTitle"
       from documents d
       join document_files df on df.document_id = d.id
       where d.engagement_id = ?
         and (?::int is null or d.request_class_id = ?)
         and (?::text is null or d.category = ?)
       order by d.id, df.version desc`,
      [engagementId, requestClassId, requestClassId, category, category],
    );
    if (rows.length === 0) throw new Error('No document files matched this export');

    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', reject);
      archive.on('error', reject);
    });
    archive.pipe(output);
    for (const row of rows) {
      const bytes = await this.download(row.storageKey);
      const folder = this.safeName(row.documentTitle);
      archive.append(Readable.from(bytes), { name: `${folder}/${this.safeName(row.fileName)}` });
    }
    await archive.finalize();
    const zip = await completed;

    const fileName = `documents-${engagementId}-${new Date().toISOString().slice(0, 10)}.zip`;
    const storageKey = await this.upload(engagementId, fileName, zip);
    const link =
      `/api/bff/proxy/documents/exports/download` +
      `?engagementId=${encodeURIComponent(engagementId)}` +
      `&key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(fileName)}`;
    const now = new Date();
    await em.getConnection().execute(
      `insert into notifications
       (id, created_at, updated_at, user_id, type, title, body, entity_type, entity_id, link, is_read, email_sent)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, false)`,
      [
        randomUUID(),
        now,
        now,
        actorUserId,
        'document.export_ready',
        'Document export ready',
        `${rows.length} document file(s) are ready to download`,
        'engagement',
        engagementId,
        link,
      ],
    );
  }

  private safeName(value: string): string {
    return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 180) || 'document';
  }

  private async download(storageKey: string): Promise<Buffer> {
    if (this.config.get('STORAGE_DRIVER', 'local') === 'local') {
      return readFile(path.join(this.config.get('LOCAL_STORAGE_DIR', '../api/storage'), storageKey));
    }
    const response = await this.r2().send(new GetObjectCommand({
      Bucket: this.config.get<string>('R2_BUCKET')!,
      Key: storageKey,
    }));
    if (!response.Body) throw new Error(`Storage object is empty: ${storageKey}`);
    return Buffer.from(await response.Body.transformToByteArray());
  }

  private async upload(engagementId: string, fileName: string, bytes: Buffer): Promise<string> {
    const prefix = this.config.get('STORAGE_DRIVER', 'local') === 'r2'
      ? `${this.config.get('R2_OBJECT_PREFIX', 'abdcshare')}/`
      : '';
    const storageKey = `${prefix}exports/${engagementId}/${randomUUID()}-${fileName}`;
    if (this.config.get('STORAGE_DRIVER', 'local') === 'local') {
      const filePath = path.join(this.config.get('LOCAL_STORAGE_DIR', '../api/storage'), storageKey);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes);
    } else {
      await this.r2().send(new PutObjectCommand({
        Bucket: this.config.get<string>('R2_BUCKET')!,
        Key: storageKey,
        Body: bytes,
        ContentType: 'application/zip',
      }));
    }
    return storageKey;
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
}
