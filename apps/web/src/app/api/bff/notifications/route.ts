import { NextResponse } from 'next/server';
import { getAccessTokenWithRefresh, upstream } from '@/lib/bff/upstream';
import { mapApiError } from '@/lib/bff/errors';

export async function GET(req: Request): Promise<NextResponse> {
  const access = await getAccessTokenWithRefresh();
  if (!access) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const result = await upstream(`/api/notifications${url.search}`, {
    method: 'GET',
    accessToken: access,
  });

  if (result.status >= 400) {
    return NextResponse.json(mapApiError(result.status, result.body), { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
