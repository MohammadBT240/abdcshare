import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';

interface SubmissionFileRow {
  storageKey: string;
  fileName: string;
}

interface SubmissionMeta {
  requestId: string;
  submitterName: string | null;
}

/** Zip current (non-superseded) submission files and notify the requester. */
@Injectable()
export class SubmissionExportService {
  private readonly logger = new Logger(SubmissionExportService.name);

  constructor(private readonly config: ConfigService) {}

  async export(payload: Record<string, unknown>, em: EntityManager): Promise<void> {
    const submissionId = String(payload.submissionId ?? '');
    const actorUserId = String(payload.actorUserId ?? '');
    if (!submissionId || !actorUserId) {
      throw new Error('Invalid submission export payload');
    }

    try {
      const meta = await em.getConnection().execute<SubmissionMeta[]>(
        `select r.id as "requestId",
                coalesce(u.full_name, u.email) as "submitterName"
         from client_submissions s
         join requests r on r.id = s.request_id
         join users u on u.id = s.submitted_by_id
         where s.id = ?`,
        [submissionId],
      );
      const row = meta[0];
      if (!row) throw new Error('Submission not found');

      const files = await em.getConnection().execute<SubmissionFileRow[]>(
        `select sf.storage_key as "storageKey", sf.file_name as "fileName"
         from submission_files sf
         where sf.submission_id = ?
           and sf.status <> 'Draft'
           and not exists (
             select 1 from submission_files newer
             where newer.submission_id = sf.submission_id
               and newer.replaces_file_id = sf.id
           )
         order by sf.uploaded_at asc`,
        [submissionId],
      );
      if (files.length === 0) throw new Error('No files to export on this submission');

      const usedNames = new Set<string>();
      const archive = archiver('zip', { zlib: { level: 6 } });
      const output = new PassThrough();
      const chunks: Buffer[] = [];
      output.on('data', (chunk: Buffer) => chunks.push(chunk));
      const completed = new Promise<Buffer>((resolve, reject) => {
        output.on('end', () => resolve(Buffer.concat(chunks)));
        output.on('error', reject);
        archive.on('error', reject);
      });
      archive.pipe(output);

      for (const file of files) {
        const bytes = await this.download(file.storageKey);
        archive.append(Readable.from(bytes), {
          name: this.uniqueName(this.safeName(file.fileName), usedNames),
        });
      }
      await archive.finalize();
      const zip = await completed;

      const stamp = new Date().toISOString().slice(0, 10);
      const who = this.safeName(row.submitterName || 'response');
      const fileName = `${who}-${stamp}.zip`;
      const storageKey = await this.upload(submissionId, fileName, zip);
      // Short app link — client mints a fresh signed URL on click (avoids varchar/expiry issues).
      const link =
        `/api/bff/proxy/submissions/${submissionId}/exports/download` +
        `?key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(fileName)}`;

      await this.insertNotification(em, {
        userId: actorUserId,
        type: 'submission.export_ready',
        title: 'Response download ready',
        body: `${files.length} file${files.length === 1 ? '' : 's'} from ${row.submitterName || 'the client'} are ready to download`,
        entityType: 'submission',
        entityId: submissionId,
        link,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Submission export failed for ${submissionId}: ${message}`);
      await this.insertNotification(em, {
        userId: actorUserId,
        type: 'submission.export_failed',
        title: 'Response download failed',
        body: message.slice(0, 500),
        entityType: 'submission',
        entityId: submissionId,
        link: null,
      });
      // Seal as handled so outbox doesn't retry forever; user was notified.
    }
  }

  private async insertNotification(
    em: EntityManager,
    input: {
      userId: string;
      type: string;
      title: string;
      body: string;
      entityType: string;
      entityId: string;
      link: string | null;
    },
  ): Promise<void> {
    const now = new Date();
    await em.getConnection().execute(
      `insert into notifications
       (id, created_at, updated_at, user_id, type, title, body, entity_type, entity_id, link, is_read, email_sent)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, false)`,
      [
        randomUUID(),
        now,
        now,
        input.userId,
        input.type,
        input.title,
        input.body,
        input.entityType,
        input.entityId,
        input.link,
      ],
    );
  }

  private safeName(value: string): string {
    return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 180) || 'file';
  }

  private uniqueName(base: string, used: Set<string>): string {
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    const ext = path.extname(base);
    const stem = ext ? base.slice(0, -ext.length) : base;
    let i = 2;
    let candidate = `${stem} (${i})${ext}`;
    while (used.has(candidate)) {
      i += 1;
      candidate = `${stem} (${i})${ext}`;
    }
    used.add(candidate);
    return candidate;
  }

  private async download(storageKey: string): Promise<Buffer> {
    if (this.config.get('STORAGE_DRIVER', 'local') === 'local') {
      return readFile(
        path.join(this.config.get('LOCAL_STORAGE_DIR', '../api/storage'), storageKey),
      );
    }
    const response = await this.r2().send(
      new GetObjectCommand({
        Bucket: this.config.get<string>('R2_BUCKET')!,
        Key: storageKey,
      }),
    );
    if (!response.Body) throw new Error(`Storage object is empty: ${storageKey}`);
    return Buffer.from(await response.Body.transformToByteArray());
  }

  private async upload(submissionId: string, fileName: string, bytes: Buffer): Promise<string> {
    const prefix =
      this.config.get('STORAGE_DRIVER', 'local') === 'r2'
        ? `${this.config.get('R2_OBJECT_PREFIX', 'abdcshare')}/`
        : '';
    const storageKey = `${prefix}exports/submissions/${submissionId}/${randomUUID()}-${fileName}`;
    if (this.config.get('STORAGE_DRIVER', 'local') === 'local') {
      const filePath = path.join(
        this.config.get('LOCAL_STORAGE_DIR', '../api/storage'),
        storageKey,
      );
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes);
    } else {
      await this.r2().send(
        new PutObjectCommand({
          Bucket: this.config.get<string>('R2_BUCKET')!,
          Key: storageKey,
          Body: bytes,
          ContentType: 'application/zip',
        }),
      );
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
