import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { setAuthCookies } from '@/lib/auth/cookies';
import { jsonError } from '@/lib/bff/auth-helpers';
import type { AuthTokens } from '@abdcshare/api-client';

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as { email?: string; password?: string };
  const client = createServerApiClient();
  const { data, response, error } = await client.POST('/api/auth/login', {
    body: { email: body.email ?? '', password: body.password ?? '' },
  });

  const tokens =
    (data as AuthTokens | undefined) ??
    ((await response.clone().json().catch(() => null)) as AuthTokens | null);

  if (!response.ok || !tokens?.accessToken) {
    return jsonError(response.status, error ?? tokens);
  }

  await setAuthCookies(tokens.accessToken, tokens.refreshToken);
  return NextResponse.json({ user: tokens.user });
}
