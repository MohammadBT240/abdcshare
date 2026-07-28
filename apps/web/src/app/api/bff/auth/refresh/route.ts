import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { clearAuthCookies, getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as { refreshToken?: string };
  const token = body.refreshToken ?? (await getRefreshToken());
  if (!token) return NextResponse.json({ message: 'No refresh token' }, { status: 401 });

  const client = createServerApiClient();
  const { data, response, error } = await client.POST('/api/auth/refresh', {
    body: { refreshToken: token },
  });
  if (!response.ok || !data) {
    await clearAuthCookies();
    return jsonError(response.status, error);
  }

  await setAuthCookies(data.accessToken, data.refreshToken);
  return NextResponse.json({ ok: true });
}
