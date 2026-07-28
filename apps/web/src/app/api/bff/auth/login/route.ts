import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { setAuthCookies } from '@/lib/auth/cookies';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as { email?: string; password?: string };
  const client = createServerApiClient();
  const { data, response, error } = await client.POST('/api/auth/login', {
    body: { email: body.email ?? '', password: body.password ?? '' },
  });

  if (!response.ok || !data) {
    return jsonError(response.status, error);
  }

  await setAuthCookies(data.accessToken, data.refreshToken);
  return NextResponse.json({ user: data.user });
}
