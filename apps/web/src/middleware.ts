import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants";

function isProtectedAppRoute(pathname: string): boolean {
  const protectedRoots = [
    "/dashboard",
    "/admin",
    "/engagements",
    "/requests",
    "/reviews",
    "/final-reports",
    "/reports",
    "/partner-reports",
    "/settings",
  ];
  return protectedRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

function hasSession(req: NextRequest): boolean {
  return Boolean(
    req.cookies.get(ACCESS_COOKIE)?.value ||
      req.cookies.get(REFRESH_COOKIE)?.value,
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = hasSession(req);

  if (isProtectedAppRoute(pathname) && !signedIn) {
    const login = new URL("/login", req.url);
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  if (signedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname === "/change-password" && !signedIn) {
    const login = new URL("/login", req.url);
    login.searchParams.set("redirect", "/change-password");
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/engagements",
    "/engagements/:path*",
    "/requests",
    "/requests/:path*",
    "/reviews",
    "/reviews/:path*",
    "/final-reports",
    "/final-reports/:path*",
    "/reports",
    "/reports/:path*",
    "/partner-reports",
    "/partner-reports/:path*",
    "/settings",
    "/settings/:path*",
    "/login",
    "/change-password",
    "/forgot-password",
    "/reset-password",
  ],
};
