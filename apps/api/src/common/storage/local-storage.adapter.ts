import {
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import { buildStorageKey } from "./storage-key.util";
import type {
  DirectUploadInput,
  MultipartCreateResult,
  MultipartPart,
  PresignDownloadOptions,
  PresignedUpload,
  PresignUploadInput,
  StoragePort,
} from "./storage.port";

/**
 * Dependency-free dev storage. Generates stable keys and dev upload/download URLs
 * pointing at the API's `/api/storage/local` endpoints. **Not for production** —
 * production swaps in the R2 (S3 SDK) adapter, keying off `STORAGE_DRIVER=r2`.
 *
 * Multipart: parts staged under `LOCAL_STORAGE_DIR/.multipart/<uploadId>/`,
 * concatenated on complete.
 */
export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly config: ConfigService) {}

  private base(): string {
    return this.config
      .get<string>("STORAGE_PUBLIC_BASE_URL", "http://localhost:4000")
      .replace(/\/+$/, "");
  }

  private rootDir(): string {
    return this.config.get<string>("LOCAL_STORAGE_DIR", "./storage");
  }

  private multipartDir(uploadId: string): string {
    return path.join(this.rootDir(), ".multipart", uploadId);
  }

  private metaPath(uploadId: string): string {
    return path.join(this.multipartDir(uploadId), "meta.json");
  }

  presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName);
    const expiresIn = this.config.get<number>("STORAGE_UPLOAD_TTL", 900);
    return Promise.resolve({
      storageKey,
      uploadUrl: `${this.base()}/api/storage/local/${encodeURIComponent(storageKey)}`,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      expiresIn,
    });
  }

  async upload(input: DirectUploadInput): Promise<{ storageKey: string }> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName);
    const filePath = path.join(this.rootDir(), storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    return { storageKey };
  }

  presignDownload(
    storageKey: string,
    downloadName?: string,
    options?: PresignDownloadOptions,
  ): Promise<string> {
    const params = new URLSearchParams();
    if (downloadName) {
      const disposition = options?.disposition ?? "attachment";
      if (disposition === "inline") {
        params.set("inline", downloadName);
      } else {
        params.set("download", downloadName);
      }
    }
    const q = params.size ? `?${params.toString()}` : "";
    return Promise.resolve(
      `${this.base()}/api/storage/local/${encodeURIComponent(storageKey)}${q}`,
    );
  }

  async createMultipart(
    input: PresignUploadInput,
  ): Promise<MultipartCreateResult> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName);
    const uploadId = randomUUID();
    const dir = this.multipartDir(uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      this.metaPath(uploadId),
      JSON.stringify({ storageKey, contentType: input.contentType }),
    );
    return { storageKey, uploadId };
  }

  async presignPart(
    storageKey: string,
    uploadId: string,
    partNumber: number,
  ): Promise<{ url: string }> {
    // Local "presign" points at a part PUT endpoint on the API.
    const url =
      `${this.base()}/api/storage/local-multipart/${encodeURIComponent(uploadId)}` +
      `/${partNumber}?key=${encodeURIComponent(storageKey)}`;
    return { url };
  }

  async completeMultipart(
    storageKey: string,
    uploadId: string,
    parts: MultipartPart[],
  ): Promise<void> {
    const dir = this.multipartDir(uploadId);
    const metaRaw = await readFile(this.metaPath(uploadId), "utf8");
    const meta = JSON.parse(metaRaw) as { storageKey: string };
    if (meta.storageKey !== storageKey) {
      throw new Error("Multipart storageKey mismatch");
    }
    const ordered = parts.slice().sort((a, b) => a.partNumber - b.partNumber);
    const chunks: Buffer[] = [];
    for (const part of ordered) {
      chunks.push(await readFile(path.join(dir, String(part.partNumber))));
    }
    const dest = path.join(this.rootDir(), storageKey);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.concat(chunks));
    await rm(dir, { recursive: true, force: true });
  }

  async abortMultipart(_storageKey: string, uploadId: string): Promise<void> {
    await rm(this.multipartDir(uploadId), { recursive: true, force: true });
  }

  async head(storageKey: string): Promise<{ sizeBytes: number } | null> {
    try {
      const s = await stat(path.join(this.rootDir(), storageKey));
      return { sizeBytes: s.size };
    } catch {
      return null;
    }
  }

  async getObject(storageKey: string): Promise<Buffer> {
    return readFile(path.join(this.rootDir(), storageKey));
  }

  async getObjectRange(
    storageKey: string,
    start: number,
    endInclusive: number,
  ): Promise<Buffer> {
    const { open } = await import("node:fs/promises");
    const filePath = path.join(this.rootDir(), storageKey);
    const length = endInclusive - start + 1;
    if (length <= 0) throw new Error("Invalid byte range");
    const fh = await open(filePath, "r");
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, start);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  /** Used by LocalMultipartController to stage a part body. */
  async writeLocalPart(
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<string> {
    const dir = this.multipartDir(uploadId);
    await mkdir(dir, { recursive: true });
    const partPath = path.join(dir, String(partNumber));
    await writeFile(partPath, body);
    // Fake ETag for local complete.
    return `"local-part-${partNumber}-${body.length}"`;
  }

  async listLocalParts(uploadId: string): Promise<string[]> {
    try {
      return await readdir(this.multipartDir(uploadId));
    } catch {
      return [];
    }
  }
}
