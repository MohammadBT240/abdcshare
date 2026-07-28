import { NextResponse } from 'next/server';
import { createServerApiClient } from '@/lib/auth/api';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as { email?: string };
  const client = createServerApiClient();
  const { response, error } = await client.POST('/api/auth/forgot-password', {
    body: { email: body.email ?? '' },
  });
  if (!response.ok) return jsonError(response.status, error);
  return NextResponse.json({ ok: true }, { status: 202 });
}
