import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';
import { mapApiError } from '@/lib/bff/errors';

/** Call /auth/me with silent refresh on 401. Returns user JSON or null. */
export async function fetchMeWithRefresh(): Promise<{ user: unknown } | null> {
  let access = await getAccessToken();
  const refresh = await getRefreshToken();
  if (!access && !refresh) return null;

  const tryMe = async (token?: string) => {
    const client = createServerApiClient(token);
    return client.GET('/api/auth/me');
  };

  let res = await tryMe(access);
  if (res.response.status === 401 && refresh) {
    const refreshClient = createServerApiClient();
    const rotated = await refreshClient.POST('/api/auth/refresh', {
      body: { refreshToken: refresh },
    });
    if (rotated.data?.accessToken && rotated.data.refreshToken) {
      await setAuthCookies(rotated.data.accessToken, rotated.data.refreshToken);
      access = rotated.data.accessToken;
      res = await tryMe(access);
    } else {
      await clearAuthCookies();
      return null;
    }
  }

  if (!res.response.ok || !res.data) {
    if (res.response.status === 401) await clearAuthCookies();
    return null;
  }
  return { user: res.data };
}

export function jsonError(status: number, body: unknown): NextResponse {
  return NextResponse.json(mapApiError(status, body), { status });
}
