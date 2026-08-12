import { NextResponse } from 'next/server';
import { forwardedIpHeadersFromRequest } from '@/lib/bff/client-ip';
import { upstreamWithAuth } from '@/lib/bff/upstream';
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
  'company-profiles',
  'dashboard',
  'search',
  'engagements',
  'requests',
  'submissions',
  'messages',
  'documents',
  'reviews',
  'final-reports',
  'partner-reports',
  'notifications',
  'audit',
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

  const url = new URL(req.url);
  const apiPath = `/api/${path.join('/')}${url.search}`;
  const method = req.method.toUpperCase();
  const contentType = req.headers.get('content-type');
  const isMultipart = Boolean(contentType?.includes('multipart/form-data'));

  let body: string | ArrayBuffer | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    if (isMultipart) {
      body = await req.arrayBuffer();
    } else {
      body = await req.text().catch(() => null);
    }
  }

  const result = await upstreamWithAuth(apiPath, {
    method,
    body,
    contentType,
    forwardHeaders: forwardedIpHeadersFromRequest(req),
  });

  if ('unauthorized' in result) {
    return NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 });
  }

  if (result.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  if (!result.contentType?.includes('application/json')) {
    const headers: Record<string, string> = {};
    if (result.contentType) headers['Content-Type'] = result.contentType;
    if (result.contentDisposition) headers['Content-Disposition'] = result.contentDisposition;

    if (result.body instanceof ArrayBuffer) {
      return new NextResponse(result.body, { status: result.status, headers });
    }
    return new NextResponse(typeof result.body === 'string' ? result.body : '', {
      status: result.status,
      headers,
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
