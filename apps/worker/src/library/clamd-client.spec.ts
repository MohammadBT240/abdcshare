import net from 'node:net';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { parseClamdReply, scanStream } from './clamd-client';

// Built from two halves so this source file itself never matches the EICAR signature.
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$' + 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/** A clamd test double: records the INSTREAM framing and answers with `reply(body)`. */
function fakeClamd(reply: (body: Buffer) => string): Promise<{ port: number; close: () => void; received: Buffer[] }> {
  const received: Buffer[] = [];
  return new Promise((resolve) => {
    const server = net.createServer((sock) => {
      let buf = Buffer.alloc(0);
      sock.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        const cmd = 'zINSTREAM\0';
        if (buf.length < cmd.length) return;
        let off = cmd.length;
        const parts: Buffer[] = [];
        while (off + 4 <= buf.length) {
          const len = buf.readUInt32BE(off);
          if (len === 0) {
            const body = Buffer.concat(parts);
            received.push(body);
            sock.end(`stream: ${reply(body)}\0`);
            return;
          }
          if (off + 4 + len > buf.length) return;
          parts.push(buf.subarray(off + 4, off + 4 + len));
          off += 4 + len;
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({ port, close: () => server.close(), received });
    });
  });
}

describe('parseClamdReply', () => {
  it('reads OK, FOUND and errors', () => {
    expect(parseClamdReply('stream: OK\0')).toEqual({ infected: false, signature: null });
    expect(parseClamdReply('stream: Eicar-Test-Signature FOUND\0')).toEqual({ infected: true, signature: 'Eicar-Test-Signature' });
    expect(() => parseClamdReply('INSTREAM size limit exceeded. ERROR\0')).toThrow('clamd error');
    expect(() => parseClamdReply('')).toThrow('empty reply');
  });
});

describe('scanStream (clamd test double)', () => {
  it('frames the stream in length-prefixed chunks and hashes it on the way', async () => {
    const clamd = await fakeClamd((body) => (body.toString().includes('EICAR') ? 'Eicar-Test-Signature FOUND' : 'OK'));
    const data = Buffer.alloc(200_000, 7);
    const res = await scanStream(Readable.from([data.subarray(0, 150_000), data.subarray(150_000)]), {
      host: '127.0.0.1',
      port: clamd.port,
      chunkSize: 64 * 1024,
    });
    expect(res).toMatchObject({ infected: false, signature: null, bytes: 200_000 });
    expect(res.sha256).toBe(createHash('sha256').update(data).digest('hex'));
    expect(clamd.received[0]!.equals(data)).toBe(true);

    const bad = await scanStream(Readable.from([Buffer.from(EICAR)]), { host: '127.0.0.1', port: clamd.port });
    expect(bad).toMatchObject({ infected: true, signature: 'Eicar-Test-Signature' });
    clamd.close();
  });

  it('fails cleanly when clamd is unreachable', async () => {
    await expect(scanStream(Readable.from([Buffer.from('x')]), { host: '127.0.0.1', port: 1, timeoutMs: 2000 })).rejects.toThrow();
  });
});

// Real clamd (set CLAMD_HOST; needs a signature database that knows EICAR).
const host = process.env.CLAMD_HOST;
(host ? describe : describe.skip)('scanStream (real clamd)', () => {
  it('detects the EICAR test file and passes a clean one', async () => {
    const port = Number(process.env.CLAMD_PORT ?? 3310);
    const infected = await scanStream(Readable.from([Buffer.from(EICAR)]), { host: host!, port });
    expect(infected.infected).toBe(true);
    expect(infected.signature).toMatch(/eicar/i);
    const clean = await scanStream(Readable.from([Buffer.from('just a memo')]), { host: host!, port });
    expect(clean.infected).toBe(false);
  });
});
