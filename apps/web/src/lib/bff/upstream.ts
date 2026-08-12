import { getApiBaseUrl } from '@/lib/auth/api';
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';

/** Deduplicate concurrent rotates for the same refresh token (per server isolate). */
const refreshInflight = new Map<string, Promise<string | null>>();

async function rotateRefreshToken(refresh: string): Promise<string | null> {
  const existing = refreshInflight.get(refresh);
  if (existing) return existing;

  const run = (async (): Promise<string | null> => {
    try {
      const rotated = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!rotated.ok) {
        await clearAuthCookies();
        return null;
      }
      const body = (await rotated.json()) as { accessToken?: string; refreshToken?: string };
      if (!body.accessToken || !body.refreshToken) {
        await clearAuthCookies();
        return null;
      }
      await setAuthCookies(body.accessToken, body.refreshToken);
      return body.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInflight.delete(refresh);
  });

  refreshInflight.set(refresh, run);
  return run;
}

/**
 * Access token with silent refresh.
 * - Default: refresh only when access cookie is missing.
 * - `force: true`: always rotate (e.g. after upstream 401).
 */
export async function getAccessTokenWithRefresh(options?: {
  force?: boolean;
}): Promise<string | null> {
  const access = await getAccessToken();
  const refresh = await getRefreshToken();
  if (!access && !refresh) return null;

  if (access && !options?.force) return access;
  if (!refresh) {
    if (options?.force) await clearAuthCookies();
    return access ?? null;
  }

  return rotateRefreshToken(refresh);
}

export type UpstreamResult = {
  status: number;
  body: unknown;
  contentType: string | null;
  contentDisposition: string | null;
};

function isBinaryContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return (
    ct.includes('application/pdf') ||
    ct.includes('application/zip') ||
    ct.includes('application/octet-stream') ||
    ct.includes('application/vnd.') ||
    ct.startsWith('image/') ||
    ct.startsWith('audio/') ||
    ct.startsWith('video/')
  );
}

/** Forward a request to the Nest API with bearer auth. */
export async function upstream(
  apiPath: string,
  init: {
    method: string;
    accessToken: string;
    body?: string | ArrayBuffer | null;
    contentType?: string | null;
    /** Client IP headers from the BFF (`X-Real-IP` / `X-Forwarded-For`). */
    forwardHeaders?: Record<string, string>;
  },
): Promise<UpstreamResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${init.accessToken}`,
    ...(init.forwardHeaders ?? {}),
  };
  if (init.body != null && init.method !== 'GET' && init.method !== 'HEAD') {
    if (init.contentType) headers['Content-Type'] = init.contentType;
  }

  const res = await fetch(`${getApiBaseUrl()}${apiPath}`, {
    method: init.method,
    headers,
    body:
      init.method === 'GET' || init.method === 'HEAD' || init.body == null
        ? undefined
        : init.body instanceof ArrayBuffer
          ? init.body
          : init.body,
  });

  const contentType = res.headers.get('content-type');
  const contentDisposition = res.headers.get('content-disposition');
  if (res.status === 204) {
    return { status: 204, body: null, contentType, contentDisposition };
  }

  if (contentType?.includes('application/json')) {
    return {
      status: res.status,
      body: await res.json().catch(() => ({})),
      contentType,
      contentDisposition,
    };
  }

  // Binary payloads must not go through text() — UTF-8 replacement corrupts PDFs/zips.
  if (isBinaryContentType(contentType)) {
    return {
      status: res.status,
      body: await res.arrayBuffer(),
      contentType,
      contentDisposition,
    };
  }

  const text = await res.text();
  return { status: res.status, body: text, contentType, contentDisposition };
}

/**
 * Authenticated upstream call with one force-refresh retry on 401.
 * Request body must already be buffered (string / ArrayBuffer).
 */
export async function upstreamWithAuth(
  apiPath: string,
  init: {
    method: string;
    body?: string | ArrayBuffer | null;
    contentType?: string | null;
    forwardHeaders?: Record<string, string>;
  },
): Promise<UpstreamResult | { status: 401; unauthorized: true }> {
  let access = await getAccessTokenWithRefresh();
  if (!access) return { status: 401, unauthorized: true };

  let result = await upstream(apiPath, { ...init, accessToken: access });
  if (result.status !== 401) return result;

  access = await getAccessTokenWithRefresh({ force: true });
  if (!access) return { status: 401, unauthorized: true };

  result = await upstream(apiPath, { ...init, accessToken: access });
  return result;
}
