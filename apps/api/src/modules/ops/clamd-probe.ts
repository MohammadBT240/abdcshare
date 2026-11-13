import net from 'node:net';

export interface ClamdStatus {
  reachable: boolean;
  /** e.g. "ClamAV 1.4.3/27460/Wed Nov 11 09:25:02 2026" */
  version: string | null;
  /** Date of the newest signature database, from the VERSION reply. */
  signaturesAt: Date | null;
  error?: string;
}

/** Parse clamd's VERSION reply: "ClamAV <engine>/<db version>/<db date>". */
export function parseClamdVersion(reply: string): { version: string; signaturesAt: Date | null } {
  const version = reply.replace(/\0+$/, '').trim();
  const parts = version.split('/');
  const when = parts.length >= 3 ? new Date(parts.slice(2).join('/')) : null;
  return { version, signaturesAt: when && !Number.isNaN(when.getTime()) ? when : null };
}

/** Ask clamd for its version (and so its signature date). Never throws. */
export function probeClamd(host: string, port: number, timeoutMs = 3000): Promise<ClamdStatus> {
  return new Promise((resolve) => {
    let reply = '';
    const done = (status: ClamdStatus) => {
      socket.destroy();
      resolve(status);
    };
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs, () => done({ reachable: false, version: null, signaturesAt: null, error: 'timeout' }));
    socket.on('error', (err) => done({ reachable: false, version: null, signaturesAt: null, error: err.message }));
    socket.on('connect', () => socket.write('zVERSION\0'));
    socket.on('data', (d) => {
      reply += d.toString('utf8');
    });
    socket.on('end', () => done({ reachable: true, ...parseClamdVersion(reply) }));
  });
}
