import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';
import { mapApiError } from '@/lib/bff/errors';
import type { AuthTokens, AuthUser } from '@abdcshare/api-client';

/** Call /auth/me with silent refresh on 401. Returns user JSON or null. */
export async function fetchMeWithRefresh(): Promise<{ user: AuthUser } | null> {
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
    const tokens = rotated.data as Pick<AuthTokens, 'accessToken' | 'refreshToken'> | undefined;
    if (tokens?.accessToken && tokens.refreshToken) {
      await setAuthCookies(tokens.accessToken, tokens.refreshToken);
      access = tokens.accessToken;
      res = await tryMe(access);
    } else {
      await clearAuthCookies();
      return null;
    }
  }

  if (!res.response.ok) {
    if (res.response.status === 401) await clearAuthCookies();
    return null;
  }

  const user = res.data as AuthUser | undefined;
  if (!user) return null;
  return { user };
}

export function jsonError(status: number, body: unknown): NextResponse {
  return NextResponse.json(mapApiError(status, body), { status });
}
