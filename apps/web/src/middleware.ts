import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth/constants';

function isProtectedAppRoute(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);

  if (isProtectedAppRoute(pathname) && !hasAccess) {
    const login = new URL('/login', req.url);
    login.searchParams.set('redirect', pathname);
    return NextResponse.redirect(login);
  }

  if (hasAccess && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (pathname === '/change-password' && !hasAccess) {
    const login = new URL('/login', req.url);
    login.searchParams.set('redirect', '/change-password');
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
    '/login',
    '/change-password',
    '/forgot-password',
    '/reset-password',
  ],
};
