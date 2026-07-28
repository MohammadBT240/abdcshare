import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as { token?: string; newPassword?: string };
  const client = createServerApiClient();
  const { response, error } = await client.POST('/api/auth/reset-password', {
    body: { token: body.token ?? '', newPassword: body.newPassword ?? '' },
  });
  if (!response.ok) return jsonError(response.status, error);
  return new NextResponse(null, { status: 204 });
}
