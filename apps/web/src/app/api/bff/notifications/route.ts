import { NextResponse } from 'next/server';
import { getAuthedApiClient } from '@/lib/bff/authed-client';
import { jsonError } from '@/lib/bff/auth-helpers';

export async function GET(req: Request): Promise<NextResponse> {
  const client = await getAuthedApiClient();
  if (!client) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const page = url.searchParams.get('page');
  const pageSize = url.searchParams.get('pageSize');
  const unread = url.searchParams.get('unread');

  const { data, response, error } = await client.GET('/api/notifications', {
    params: {
      query: {
        ...(page ? { page: Number(page) } : {}),
        ...(pageSize ? { pageSize: Number(pageSize) } : {}),
        ...(unread ? { unread } : {}),
      },
    },
  });

  if (!response.ok || !data) return jsonError(response.status, error);
  return NextResponse.json(data);
}
