import { NextResponse } from 'next/server';
import { getAccessTokenWithRefresh, upstream } from '@/lib/bff/upstream';
import { mapApiError } from '@/lib/bff/errors';

const ALLOWED_PREFIXES = [
  'users',
  'roles',
  'clients',
  'engagement-types',
  'request-classes',
  'request-types',
  'request-stages',
  'request-statuses',
  'departments',
  'reference',
  'company-profile',
  'dashboard',
  'search',
] as const;

function isAllowed(segments: string[]): boolean {
  if (segments.length === 0) return false;
  return (ALLOWED_PREFIXES as readonly string[]).includes(segments[0]!);
}

async function handle(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await ctx.params;
  if (!isAllowed(path)) {
    return NextResponse.json({ message: 'Not found', statusCode: 404 }, { status: 404 });
  }

  const access = await getAccessTokenWithRefresh();
  if (!access) {
    return NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 });
  }

  const url = new URL(req.url);
  const apiPath = `/api/${path.join('/')}${url.search}`;
  const method = req.method.toUpperCase();
  const contentType = req.headers.get('content-type');
  const body =
    method === 'GET' || method === 'HEAD' ? null : await req.text().catch(() => null);

  const result = await upstream(apiPath, {
    method,
    accessToken: access,
    body,
    contentType,
  });

  if (result.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  if (!result.contentType?.includes('application/json')) {
    return new NextResponse(typeof result.body === 'string' ? result.body : '', {
      status: result.status,
      headers: result.contentType ? { 'Content-Type': result.contentType } : undefined,
    });
  }

  if (result.status >= 400) {
    return NextResponse.json(mapApiError(result.status, result.body), { status: result.status });
  }

  return NextResponse.json(result.body, { status: result.status });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
