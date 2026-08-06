import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Converts Office documents to PDF via LibreOffice headless for in-app preview.
 * Requires `soffice` on PATH (libreoffice packages on the worker image).
 */
@Injectable()
export class FilePreviewService {
  private readonly logger = new Logger(FilePreviewService.name);

  constructor(private readonly config: ConfigService) {}

  async generate(payload: Record<string, unknown>, em: EntityManager): Promise<void> {
    const entityType = String(payload.entityType ?? '');
    const fileId = String(payload.fileId ?? '');
    const storageKey = String(payload.storageKey ?? '');
    const fileName = String(payload.fileName ?? 'file');
    if (!entityType || !fileId || !storageKey) {
      throw new Error('Invalid file preview payload');
    }

    if (entityType === 'request_brief') {
      await this.generateRequestBrief(fileId, storageKey, fileName, em);
      return;
    }

    const table =
      entityType === 'submission_file'
        ? 'submission_files'
        : entityType === 'document_file'
          ? 'document_files'
          : null;
    if (!table) throw new Error(`Unsupported entityType ${entityType}`);

    const existing = await em.getConnection().execute<{ preview_status: string; preview_storage_key: string | null }[]>(
      `select preview_status as preview_status, preview_storage_key as preview_storage_key from "${table}" where id = ?`,
      [fileId],
    );
    const row = existing[0];
    if (!row) {
      this.logger.warn(`Preview target missing: ${table}/${fileId}`);
      return;
    }
    if (row.preview_status === 'Ready' && row.preview_storage_key) return;
    // Already permanently failed — do not burn retries; operator can re-upload.
    if (row.preview_status === 'Failed') return;

    try {
      const previewKey = await this.convertToPdf(storageKey, fileName);
      await em.getConnection().execute(
        `update "${table}"
         set preview_storage_key = ?, preview_status = 'Ready', preview_error = null
         where id = ?`,
        [previewKey, fileId],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Preview failed for ${table}/${fileId}: ${message}`);
      await em.getConnection().execute(
        `update "${table}"
         set preview_status = 'Failed', preview_error = ?
         where id = ?`,
        [message.slice(0, 2000), fileId],
      );
    }
  }

  private async generateRequestBrief(
    requestId: string,
    storageKey: string,
    fileName: string,
    em: EntityManager,
  ): Promise<void> {
    const existing = await em.getConnection().execute<
      { brief_preview_status: string; brief_preview_storage_key: string | null }[]
    >(
      `select brief_preview_status as brief_preview_status,
              brief_preview_storage_key as brief_preview_storage_key
       from "requests" where id = ?`,
      [requestId],
    );
    const row = existing[0];
    if (!row) {
      this.logger.warn(`Preview target missing: requests/${requestId}`);
      return;
    }
    if (row.brief_preview_status === 'Ready' && row.brief_preview_storage_key) return;
    if (row.brief_preview_status === 'Failed') return;

    try {
      const previewKey = await this.convertToPdf(storageKey, fileName);
      await em.getConnection().execute(
        `update "requests"
         set brief_preview_storage_key = ?, brief_preview_status = 'Ready', brief_preview_error = null
         where id = ?`,
        [previewKey, requestId],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Preview failed for request brief ${requestId}: ${message}`);
      await em.getConnection().execute(
        `update "requests"
         set brief_preview_status = 'Failed', brief_preview_error = ?
         where id = ?`,
        [message.slice(0, 2000), requestId],
      );
    }
  }

  private async convertToPdf(storageKey: string, fileName: string): Promise<string> {
    const workDir = await mkdtemp(path.join(tmpdir(), 'abdc-preview-'));
    try {
      const inputName = path.basename(fileName) || 'input.bin';
      const inputPath = path.join(workDir, inputName);
      const bytes = await this.download(storageKey);
      await writeFile(inputPath, bytes);

      const soffice = this.config.get<string>('LIBREOFFICE_BIN', 'soffice');
      await execFileAsync(
        soffice,
        ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', workDir, inputPath],
        { timeout: 120_000 },
      );

      const pdfName = inputName.replace(/\.[^.]+$/, '') + '.pdf';
      const pdfPath = path.join(workDir, pdfName);
      const pdfBytes = await readFile(pdfPath);
      return await this.uploadPreview(pdfBytes, pdfName);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
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

  private async uploadPreview(bytes: Buffer, fileName: string): Promise<string> {
    const prefix =
      this.config.get('STORAGE_DRIVER', 'local') === 'r2'
        ? `${this.config.get('R2_OBJECT_PREFIX', 'abdcshare')}/`
        : '';
    const storageKey = `${prefix}previews/${randomUUID()}-${fileName}`;
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
          ContentType: 'application/pdf',
        }),
      );
    }
    return storageKey;
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
}
