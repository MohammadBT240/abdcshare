import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { clearAuthCookies, getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';
import { jsonError } from '@/lib/bff/auth-helpers';
import type { AuthTokens } from '@abdcshare/api-client';

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as { refreshToken?: string };
  const token = body.refreshToken ?? (await getRefreshToken());
  if (!token) return NextResponse.json({ message: 'No refresh token' }, { status: 401 });

  const client = createServerApiClient();
  const { data, response, error } = await client.POST('/api/auth/refresh', {
    body: { refreshToken: token },
  });

  const tokens =
    (data as Pick<AuthTokens, 'accessToken' | 'refreshToken'> | undefined) ??
    ((await response.clone().json().catch(() => null)) as Pick<
      AuthTokens,
      'accessToken' | 'refreshToken'
    > | null);

  if (!response.ok || !tokens?.accessToken || !tokens.refreshToken) {
    await clearAuthCookies();
    return jsonError(response.status, error ?? tokens);
  }

  await setAuthCookies(tokens.accessToken, tokens.refreshToken);
  return NextResponse.json({ ok: true });
}
