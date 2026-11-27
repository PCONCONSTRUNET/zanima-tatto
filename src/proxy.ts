import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "zanima_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname.toLowerCase() === "/mimdamin" && pathname !== "/MIMDAMIN") {
    return NextResponse.redirect(new URL("/MIMDAMIN", request.url));
  }

  if (pathname.startsWith("/admin") && !hasSessionCookie) {
    const loginUrl = new URL("/MIMDAMIN", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/minha-conta") && !hasSessionCookie) {
    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/minha-conta/:path*", "/mimdamin", "/Mimdamin"],
};
