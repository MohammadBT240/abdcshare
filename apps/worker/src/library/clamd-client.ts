import { createHash } from 'node:crypto';
import net from 'node:net';
import type { Readable } from 'node:stream';

export interface ScanResult {
  infected: boolean;
  /** ClamAV signature name when infected. */
  signature: string | null;
  /** SHA-256 of the bytes that were scanned, hex. */
  sha256: string;
  bytes: number;
  /** First bytes of the file, for type sniffing (encrypted Office / PDF detection). */
  head: Buffer;
}

/** Parse a clamd INSTREAM reply: "stream: OK", "stream: <Sig> FOUND" or "... ERROR". */
export function parseClamdReply(reply: string): { infected: boolean; signature: string | null } {
  const text = reply.replace(/\0+$/, '').trim();
  if (/:\s*OK$/.test(text)) return { infected: false, signature: null };
  const found = /:\s*(.+)\s+FOUND$/.exec(text);
  if (found) return { infected: true, signature: found[1]!.trim() };
  throw new Error(`clamd error: ${text || 'empty reply'}`);
}

/**
 * Streams a file to clamd with the INSTREAM command (S3, D24) — the object is never written to
 * the worker's disk — hashing it with SHA-256 on the way (D27). Chunks are length-prefixed
 * (4-byte big-endian); a zero-length chunk ends the stream.
 */
export function scanStream(
  source: Readable,
  opts: { host: string; port: number; timeoutMs?: number; chunkSize?: number },
): Promise<ScanResult> {
  const hash = createHash('sha256');
  const headChunks: Buffer[] = [];
  let headLen = 0;
  let bytes = 0;
  const chunkSize = opts.chunkSize ?? 64 * 1024;

  return new Promise<ScanResult>((resolve, reject) => {
    const socket = net.createConnection({ host: opts.host, port: opts.port });
    let reply = '';
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      source.destroy();
      reject(err);
    };
    socket.setTimeout(opts.timeoutMs ?? 120_000, () => fail(new Error('clamd timed out')));
    socket.on('error', fail);
    source.on('error', fail);
    socket.on('data', (d) => {
      reply += d.toString('utf8');
    });
    socket.on('end', () => {
      if (settled) return;
      try {
        const parsed = parseClamdReply(reply);
        settled = true;
        resolve({ ...parsed, sha256: hash.digest('hex'), bytes, head: Buffer.concat(headChunks).subarray(0, 1024) });
      } catch (err) {
        fail(err as Error);
      }
    });

    const write = (buf: Buffer) =>
      new Promise<void>((res, rej) => {
        if (socket.write(buf)) return res();
        socket.once('drain', res);
        socket.once('error', rej);
      });

    socket.once('connect', () => {
      void (async () => {
        try {
          await write(Buffer.from('zINSTREAM\0'));
          for await (const raw of source) {
            const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
            hash.update(chunk);
            bytes += chunk.length;
            if (headLen < 1024) {
              headChunks.push(chunk.subarray(0, 1024 - headLen));
              headLen += Math.min(chunk.length, 1024 - headLen);
            }
            for (let i = 0; i < chunk.length; i += chunkSize) {
              const part = chunk.subarray(i, i + chunkSize);
              const len = Buffer.alloc(4);
              len.writeUInt32BE(part.length, 0);
              await write(len);
              await write(part);
            }
          }
          await write(Buffer.alloc(4)); // end of stream
        } catch (err) {
          fail(err as Error);
        }
      })();
    });
  });
}

/** Hash only (development without clamd). */
export async function hashStream(source: Readable): Promise<Omit<ScanResult, 'infected' | 'signature'>> {
  const hash = createHash('sha256');
  const head: Buffer[] = [];
  let bytes = 0;
  for await (const raw of source) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
    hash.update(chunk);
    if (bytes < 1024) head.push(chunk.subarray(0, 1024 - bytes));
    bytes += chunk.length;
  }
  return { sha256: hash.digest('hex'), bytes, head: Buffer.concat(head) };
}
