/** Header bag compatible with Fetch `Headers` and plain maps. */
export type HeaderReader = {
  get(name: string): string | null;
};

/** Strip surrounding brackets / quotes and optional `:port` for IPv4. */
function normalizeIp(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  if (s.startsWith('[') && s.includes(']')) {
    // [IPv6]:port or [IPv6]
    const end = s.indexOf(']');
    s = s.slice(1, end);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(s)) {
    s = s.replace(/:\d+$/, '');
  }
  return s || null;
}

/**
 * Resolve the end-user client IP from proxy headers set by nginx (or the BFF).
 * Prefers `X-Real-IP`, else the leftmost `X-Forwarded-For` hop.
 */
export function getClientIp(headers: HeaderReader): string | null {
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    const normalized = normalizeIp(realIp);
    if (normalized) return normalized;
  }

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) {
      const normalized = normalizeIp(first);
      if (normalized) return normalized;
    }
  }

  return null;
}

/** Headers to merge onto Nest upstream fetches so Express `req.ip` resolves correctly. */
export function forwardedIpHeaders(headers: HeaderReader): Record<string, string> {
  const ip = getClientIp(headers);
  if (!ip) return {};
  return {
    'X-Real-IP': ip,
    'X-Forwarded-For': ip,
  };
}

/** Convenience for Next.js `Request`. */
export function getClientIpFromRequest(req: Request): string | null {
  return getClientIp(req.headers);
}

export function forwardedIpHeadersFromRequest(req: Request): Record<string, string> {
  return forwardedIpHeaders(req.headers);
}
