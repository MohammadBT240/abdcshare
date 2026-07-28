import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { clearAuthCookies, getAccessToken, getRefreshToken } from '@/lib/auth/cookies';

export async function POST(): Promise<NextResponse> {
  const refresh = await getRefreshToken();
  const access = await getAccessToken();
  if (refresh) {
    const client = createServerApiClient(access);
    await client.POST('/api/auth/logout', { body: { refreshToken: refresh } });
  }
  await clearAuthCookies();
  return new NextResponse(null, { status: 204 });
}
