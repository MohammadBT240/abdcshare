import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { getAccessToken } from '@/lib/auth/cookies';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(req: Request): Promise<NextResponse> {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
  const client = createServerApiClient(access);
  const { response, error } = await client.POST('/api/auth/change-password', {
    body: {
      currentPassword: body.currentPassword ?? '',
      newPassword: body.newPassword ?? '',
    },
  });
  if (!response.ok) return jsonError(response.status, error);
  return new NextResponse(null, { status: 204 });
}
