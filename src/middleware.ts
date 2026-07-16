import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// UX redirect ONLY (SPEC §4.1) — the cookie's presence is checked, not its
// validity. Every server component, action, and route handler re-validates
// with requireUser(); middleware being bypassed must never expose data
// (CVE-2025-29927 class).
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!sessionCookie && !isLogin) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  if (sessionCookie && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|samples).*)"],
};
