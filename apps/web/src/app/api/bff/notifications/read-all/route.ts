import { NextResponse } from 'next/server';
import { getAuthedApiClient } from '@/lib/bff/authed-client';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function POST(): Promise<NextResponse> {
  const client = await getAuthedApiClient();
  if (!client) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { data, response, error } = await client.POST('/api/notifications/read-all');
  if (!response.ok || !data) return jsonError(response.status, error);
  return NextResponse.json(data);
}
