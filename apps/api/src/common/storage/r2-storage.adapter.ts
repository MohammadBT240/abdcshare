import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigService } from '@nestjs/config';
import { buildStorageKey } from './storage-key.util';
import type { PresignedUpload, PresignUploadInput, StoragePort } from './storage.port';

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

  async presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName, this.objectPrefix);
    const expiresIn = this.config.get<number>('STORAGE_UPLOAD_TTL', 900);
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

  async presignDownload(storageKey: string, downloadName?: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ...(downloadName
        ? { ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, '')}"` }
        : {}),
    });
    const expiresIn = this.config.get<number>('STORAGE_UPLOAD_TTL', 900);
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
