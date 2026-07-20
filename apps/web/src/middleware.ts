import { NextResponse, type NextRequest } from 'next/server';

// Coarse route gate (Phase 1 wires real session cookies). API remains the real authz gate.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: ['/(app)/:path*'] };
