import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { getAccessTokenWithRefresh } from '@/lib/bff/upstream';
import { mapApiError } from '@/lib/bff/errors';
import type { AuthUser } from '@abdcshare/api-client';

/** Call /auth/me with silent refresh on 401. Returns user JSON or null. */
export async function fetchMeWithRefresh(): Promise<{ user: AuthUser } | null> {
  let access = await getAccessTokenWithRefresh();
  if (!access) return null;

  const tryMe = async (token: string) => {
    const client = createServerApiClient(token);
    return client.GET('/api/auth/me');
  };

  let res = await tryMe(access);
  if (res.response.status === 401) {
    access = await getAccessTokenWithRefresh({ force: true });
    if (!access) return null;
    res = await tryMe(access);
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
