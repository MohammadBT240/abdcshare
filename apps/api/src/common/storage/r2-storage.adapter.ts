import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigService } from '@nestjs/config';
import { buildStorageKey } from './storage-key.util';
import type {
  DirectUploadInput,
  MultipartCreateResult,
  MultipartPart,
  PresignDownloadOptions,
  PresignedUpload,
  PresignUploadInput,
  StoragePort,
} from './storage.port';

/**
 * Cloudflare R2 adapter via the S3-compatible API. Activated when `STORAGE_DRIVER=r2`.
 */
export class R2StorageAdapter implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly objectPrefix: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('R2_ENDPOINT')!;
    this.bucket = config.get<string>('R2_BUCKET')!;
    this.objectPrefix = config.get<string>('R2_OBJECT_PREFIX', 'abdcshare');
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  private ttl(): number {
    return this.config.get<number>('STORAGE_UPLOAD_TTL', 900);
  }

  async presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName, this.objectPrefix);
    const expiresIn = this.ttl();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return {
      storageKey,
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresIn,
    };
  }

  async upload(input: DirectUploadInput): Promise<{ storageKey: string }> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName, this.objectPrefix);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: input.contentType,
        Body: input.body,
      }),
    );
    return { storageKey };
  }

  async presignDownload(
    storageKey: string,
    downloadName?: string,
    options?: PresignDownloadOptions,
  ): Promise<string> {
    const safeName = downloadName?.replace(/"/g, '') ?? '';
    const disposition = options?.disposition ?? (downloadName ? 'attachment' : undefined);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ...(disposition && safeName
        ? { ResponseContentDisposition: `${disposition}; filename="${safeName}"` }
        : {}),
    });
    return getSignedUrl(this.client, command, { expiresIn: this.ttl() });
  }

  async createMultipart(input: PresignUploadInput): Promise<MultipartCreateResult> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName, this.objectPrefix);
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: input.contentType,
      }),
    );
    if (!result.UploadId) throw new Error('R2 CreateMultipartUpload returned no UploadId');
    return { storageKey, uploadId: result.UploadId };
  }

  async presignPart(
    storageKey: string,
    uploadId: string,
    partNumber: number,
  ): Promise<{ url: string }> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: storageKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: this.ttl() });
    return { url };
  }

  async completeMultipart(
    storageKey: string,
    uploadId: string,
    parts: MultipartPart[],
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: storageKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .slice()
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
        },
      }),
    );
  }

  async abortMultipart(storageKey: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: storageKey,
        UploadId: uploadId,
      }),
    );
  }

  async head(storageKey: string): Promise<{ sizeBytes: number } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return { sizeBytes: result.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    const body = result.Body;
    if (!body) throw new Error(`Empty object body for ${storageKey}`);
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async getObjectRange(
    storageKey: string,
    start: number,
    endInclusive: number,
  ): Promise<Buffer> {
    if (endInclusive < start) throw new Error('Invalid byte range');
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Range: `bytes=${start}-${endInclusive}`,
      }),
    );
    const body = result.Body;
    if (!body) throw new Error(`Empty object body for ${storageKey}`);
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }
}
