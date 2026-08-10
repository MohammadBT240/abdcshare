import { NextResponse } from 'next/server';
import { withAuthedRetry } from '@/lib/bff/authed-client';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function GET(): Promise<NextResponse> {
  const result = await withAuthedRetry((client) => client.GET('/api/notifications/unread-count'));
  if (!result) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!result.response.ok || !result.data) return jsonError(result.response.status, result.error);
  return NextResponse.json(result.data);
}
