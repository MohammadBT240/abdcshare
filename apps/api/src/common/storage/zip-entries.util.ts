import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import JSZip from 'jszip';

const MAX_ENTRIES = 2_000;
/** Reject only extreme expansion ratios (zip-bomb heuristic). */
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024 * 1024;
const BOMB_RATIO = 200;
/** Cap for extracting a single zip member for in-app open/download. */
const MAX_ENTRY_BYTES = 80 * 1024 * 1024;
/** Full-buffer path is fine for small archives (tests + tiny uploads). */
const SMALL_ZIP_BYTES = 32 * 1024 * 1024;
const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

export interface ZipEntryInfo {
  name: string;
  size: number;
  isDirectory: boolean;
}

export interface ExtractedZipEntry {
  name: string;
  data: Buffer;
  mimeType: string;
}

/** Random-access bytes — enables listing/extract without loading the whole archive. */
export interface ZipByteSource {
  size(): Promise<number>;
  read(start: number, endInclusive: number): Promise<Buffer>;
}

interface CdEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function guessMime(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] ?? 'application/octet-stream';
}

export function bufferZipSource(buffer: Buffer): ZipByteSource {
  return {
    size: async () => buffer.byteLength,
    read: async (start, endInclusive) => {
      if (start < 0 || endInclusive >= buffer.byteLength || start > endInclusive) {
        throw new BadRequestException('Invalid zip byte range');
      }
      return buffer.subarray(start, endInclusive + 1);
    },
  };
}

function findEocdOffset(tail: Buffer, fileSize: number, tailStart: number): number {
  // EOCD is at least 22 bytes; comment can be up to 65535.
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIG) {
      const commentLen = tail.readUInt16LE(i + 20);
      if (i + 22 + commentLen === tail.byteLength) {
        return tailStart + i;
      }
      // Prefer exact match; if comment length is wrong but sig found near end, still accept.
      if (fileSize - (tailStart + i) <= 22 + 65535) {
        return tailStart + i;
      }
    }
  }
  throw new BadRequestException('Invalid or corrupted zip archive');
}

async function readCentralDirectory(source: ZipByteSource): Promise<CdEntry[]> {
  const fileSize = await source.size();
  if (fileSize < 22) {
    throw new BadRequestException('Invalid or corrupted zip archive');
  }

  const tailLen = Math.min(fileSize, 65_557);
  const tailStart = fileSize - tailLen;
  const tail = await source.read(tailStart, fileSize - 1);

  const eocdAbs = findEocdOffset(tail, fileSize, tailStart);
  // Zip64 end-of-central-directory locator is 20 bytes immediately before EOCD.
  if (eocdAbs >= 20) {
    const locator = await source.read(eocdAbs - 20, eocdAbs - 1);
    if (locator.readUInt32LE(0) === ZIP64_LOCATOR_SIG) {
      throw new BadRequestException(
        'This zip uses the Zip64 format and cannot be browsed in-app. Download the archive instead.',
      );
    }
  }
  const eocd = await source.read(eocdAbs, Math.min(fileSize - 1, eocdAbs + 21));
  const totalEntries = eocd.readUInt16LE(10);
  const cdSize = eocd.readUInt32LE(12);
  const cdOffset = eocd.readUInt32LE(16);

  if (totalEntries > MAX_ENTRIES) {
    throw new BadRequestException(
      `Zip has more than ${MAX_ENTRIES} entries. Download the archive instead.`,
    );
  }
  if (cdSize === 0 || cdOffset + cdSize > fileSize) {
    throw new BadRequestException('Invalid or corrupted zip archive');
  }

  const cd = await source.read(cdOffset, cdOffset + cdSize - 1);
  const entries: CdEntry[] = [];
  let totalUncompressed = 0;
  let o = 0;

  while (o + 46 <= cd.byteLength) {
    if (cd.readUInt32LE(o) !== CD_SIG) break;
    const compressionMethod = cd.readUInt16LE(o + 10);
    const compressedSize = cd.readUInt32LE(o + 20);
    const uncompressedSize = cd.readUInt32LE(o + 24);
    const nameLen = cd.readUInt16LE(o + 28);
    const extraLen = cd.readUInt16LE(o + 30);
    const commentLen = cd.readUInt16LE(o + 32);
    const localHeaderOffset = cd.readUInt32LE(o + 42);
    const nameStart = o + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > cd.byteLength) {
      throw new BadRequestException('Invalid or corrupted zip archive');
    }
    const name = cd.subarray(nameStart, nameEnd).toString('utf8');

    totalUncompressed += uncompressedSize;
    if (
      totalUncompressed > MAX_UNCOMPRESSED_BYTES &&
      totalUncompressed > fileSize * BOMB_RATIO
    ) {
      throw new BadRequestException(
        'Zip looks unsafe (extreme compression). Download the archive instead.',
      );
    }

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    o = nameEnd + extraLen + commentLen;
    if (entries.length > MAX_ENTRIES) {
      throw new BadRequestException(
        `Zip has more than ${MAX_ENTRIES} entries. Download the archive instead.`,
      );
    }
  }

  return entries;
}

export async function listZipEntriesFromSource(source: ZipByteSource): Promise<ZipEntryInfo[]> {
  try {
    const cd = await readCentralDirectory(source);
    const entries: ZipEntryInfo[] = cd.map((e) => ({
      name: e.name,
      size: e.uncompressedSize,
      isDirectory: e.name.endsWith('/'),
    }));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries;
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      err instanceof Error ? `Could not read zip: ${err.message}` : 'Could not read zip archive',
    );
  }
}

/** Buffer helper used by unit tests and small in-memory archives. */
export async function listZipEntries(buffer: Buffer): Promise<ZipEntryInfo[]> {
  return listZipEntriesFromSource(bufferZipSource(buffer));
}

async function extractViaCentralDirectory(
  source: ZipByteSource,
  entryPath: string,
): Promise<ExtractedZipEntry> {
  const normalized = entryPath.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new BadRequestException('Invalid zip entry path');
  }

  const cd = await readCentralDirectory(source);
  const entry = cd.find((e) => e.name === normalized || e.name === `${normalized}/`);
  if (!entry || entry.name.endsWith('/')) {
    throw new BadRequestException('Zip entry not found');
  }
  if (entry.uncompressedSize > MAX_ENTRY_BYTES) {
    throw new BadRequestException(
      `Zip entry exceeds ${MAX_ENTRY_BYTES / (1024 * 1024)} MB limit`,
    );
  }
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    throw new BadRequestException(
      'This zip entry uses an unsupported compression method. Download the archive instead.',
    );
  }

  const local = await source.read(entry.localHeaderOffset, entry.localHeaderOffset + 29);
  if (local.readUInt32LE(0) !== LOCAL_SIG) {
    throw new BadRequestException('Invalid or corrupted zip archive');
  }
  const nameLen = local.readUInt16LE(26);
  const extraLen = local.readUInt16LE(28);
  const dataStart = entry.localHeaderOffset + 30 + nameLen + extraLen;
  if (entry.compressedSize === 0 && entry.uncompressedSize === 0) {
    const baseName = path.basename(normalized) || 'file';
    return { name: baseName, data: Buffer.alloc(0), mimeType: guessMime(baseName) };
  }
  if (entry.compressedSize <= 0) {
    throw new BadRequestException('Could not read zip entry size');
  }

  const compressed = await source.read(dataStart, dataStart + entry.compressedSize - 1);
  let data: Buffer;
  if (entry.compressionMethod === 0) {
    data = compressed;
  } else {
    try {
      data = inflateRawSync(compressed);
    } catch {
      throw new BadRequestException('Could not decompress zip entry');
    }
  }
  if (data.byteLength > MAX_ENTRY_BYTES) {
    throw new BadRequestException(
      `Zip entry exceeds ${MAX_ENTRY_BYTES / (1024 * 1024)} MB limit`,
    );
  }

  const baseName = path.basename(normalized) || 'file';
  return { name: baseName, data, mimeType: guessMime(baseName) };
}

async function extractViaJsZip(buffer: Buffer, entryPath: string): Promise<ExtractedZipEntry> {
  const normalized = entryPath.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new BadRequestException('Invalid zip entry path');
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  } catch {
    throw new BadRequestException('Invalid or corrupted zip archive');
  }
  const entry = zip.files[normalized];
  if (!entry || entry.dir) {
    throw new BadRequestException('Zip entry not found');
  }
  const data = Buffer.from(await entry.async('nodebuffer'));
  if (data.byteLength > MAX_ENTRY_BYTES) {
    throw new BadRequestException(
      `Zip entry exceeds ${MAX_ENTRY_BYTES / (1024 * 1024)} MB limit`,
    );
  }
  const baseName = path.basename(normalized) || 'file';
  return { name: baseName, data, mimeType: guessMime(baseName) };
}

export async function extractZipEntryFromSource(
  source: ZipByteSource,
  entryPath: string,
): Promise<ExtractedZipEntry> {
  try {
    const size = await source.size();
    // Small archives: JSZip is battle-tested for edge cases (data descriptors, etc.).
    if (size <= SMALL_ZIP_BYTES) {
      const buf = await source.read(0, size - 1);
      return extractViaJsZip(buf, entryPath);
    }
    return extractViaCentralDirectory(source, entryPath);
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      err instanceof Error ? `Could not extract zip entry: ${err.message}` : 'Could not extract zip entry',
    );
  }
}

export async function extractZipEntry(
  buffer: Buffer,
  entryPath: string,
): Promise<ExtractedZipEntry> {
  return extractZipEntryFromSource(bufferZipSource(buffer), entryPath);
}
