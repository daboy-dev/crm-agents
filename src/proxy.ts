import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth";

/**
 * Protects every route except the public ones below (D19). The GitHub
 * webhook authenticates itself with its HMAC signature.
 */
const PUBLIC_PATHS = ["/login", "/api/health", "/api/webhooks/github"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  const user = secret
    ? await verifySessionToken(
        request.cookies.get(SESSION_COOKIE)?.value,
        secret,
      )
    : null;
  if (user) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
