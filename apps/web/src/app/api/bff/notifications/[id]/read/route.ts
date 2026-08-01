import { NextResponse } from 'next/server';
import { getAuthedApiClient } from '@/lib/bff/authed-client';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const client = await getAuthedApiClient();
  if (!client) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const { data, response, error } = await client.POST('/api/notifications/{id}/read', {
    params: { path: { id } },
  });
  if (!response.ok || !data) return jsonError(response.status, error);
  return NextResponse.json(data);
}
