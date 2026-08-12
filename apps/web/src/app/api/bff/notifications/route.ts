import { NextResponse } from 'next/server';
import { forwardedIpHeadersFromRequest } from '@/lib/bff/client-ip';
import { upstreamWithAuth } from '@/lib/bff/upstream';
import { mapApiError } from '@/lib/bff/errors';

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const result = await upstreamWithAuth(`/api/notifications${url.search}`, {
    method: 'GET',
    forwardHeaders: forwardedIpHeadersFromRequest(req),
  });

  if ('unauthorized' in result) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (result.status >= 400) {
    return NextResponse.json(mapApiError(result.status, result.body), { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
