import { NextResponse } from 'next/server';
import { withAuthedRetry } from '@/lib/bff/authed-client';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const result = await withAuthedRetry((client) =>
    client.POST('/api/notifications/{id}/read', {
      params: { path: { id } },
    }),
  );
  if (!result) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!result.response.ok || !result.data) return jsonError(result.response.status, result.error);
  return NextResponse.json(result.data);
}
