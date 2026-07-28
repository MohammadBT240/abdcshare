import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2StorageAdapter } from './r2-storage.adapter';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
  GetObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const getSignedUrlMock = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

function config(values: Record<string, string | number>): { get: (key: string, fallback?: unknown) => unknown } {
  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  };
}

describe('R2StorageAdapter', () => {
  beforeEach(() => {
    getSignedUrlMock.mockReset();
    getSignedUrlMock.mockResolvedValue('https://r2.example/signed');
  });

  it('presignUpload returns a PUT URL and prefixed storage key', async () => {
    const adapter = new R2StorageAdapter(
      config({
        R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
        R2_BUCKET: 'abdcshare-uploads',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_OBJECT_PREFIX: 'abdcshare',
        STORAGE_UPLOAD_TTL: 900,
      }) as never,
    );

    const result = await adapter.presignUpload({
      keyPrefix: 'documents/eng-1',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
    });

    expect(result.method).toBe('PUT');
    expect(result.uploadUrl).toBe('https://r2.example/signed');
    expect(result.storageKey).toMatch(/^abdcshare\/documents\/eng-1\/.+-report\.pdf$/);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'abdcshare-uploads',
        Key: result.storageKey,
        ContentType: 'application/pdf',
      }),
    );
    expect(getSignedUrlMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 900 });
  });

  it('presignDownload passes attachment disposition when downloadName is set', async () => {
    const adapter = new R2StorageAdapter(
      config({
        R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
        R2_BUCKET: 'abdcshare-uploads',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_OBJECT_PREFIX: 'abdcshare',
        STORAGE_UPLOAD_TTL: 900,
      }) as never,
    );

    await adapter.presignDownload('abdcshare/docs/file.pdf', 'export.pdf');

    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'abdcshare-uploads',
        Key: 'abdcshare/docs/file.pdf',
        ResponseContentDisposition: 'attachment; filename="export.pdf"',
      }),
    );
  });
});
