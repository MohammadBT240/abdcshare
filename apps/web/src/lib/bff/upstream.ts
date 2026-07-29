import { getApiBaseUrl } from '@/lib/auth/api';
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';

/** Access token with one silent refresh attempt. Returns null when unauthenticated. */
export async function getAccessTokenWithRefresh(): Promise<string | null> {
  let access = await getAccessToken();
  const refresh = await getRefreshToken();
  if (!access && !refresh) return null;

  if (!access && refresh) {
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
    access = body.accessToken;
  }

  return access ?? null;
}

export type UpstreamResult = {
  status: number;
  body: unknown;
  contentType: string | null;
};

/** Forward a request to the Nest API with bearer auth. */
export async function upstream(
  apiPath: string,
  init: {
    method: string;
    accessToken: string;
    body?: string | null;
    contentType?: string | null;
  },
): Promise<UpstreamResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${init.accessToken}`,
  };
  if (init.body != null && init.method !== 'GET' && init.method !== 'HEAD') {
    headers['Content-Type'] = init.contentType ?? 'application/json';
  }

  const res = await fetch(`${getApiBaseUrl()}${apiPath}`, {
    method: init.method,
    headers,
    body: init.method === 'GET' || init.method === 'HEAD' ? undefined : (init.body ?? undefined),
  });

  const contentType = res.headers.get('content-type');
  if (res.status === 204) {
    return { status: 204, body: null, contentType };
  }

  if (contentType?.includes('application/json')) {
    return { status: res.status, body: await res.json().catch(() => ({})), contentType };
  }

  const text = await res.text();
  return { status: res.status, body: text, contentType };
}
