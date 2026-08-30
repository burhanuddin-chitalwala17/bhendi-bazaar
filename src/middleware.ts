import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge gate for the two portals.
 *
 * This is a fast rejection, not the authority. It reads a JWT claim, which survives an
 * account being demoted or blocked, and it cannot reach Postgres — so the real check is
 * `requirePlatformAdmin` / `requireOrgMember` in each portal's layout (ADR-0021).
 * Keeping it means an unauthenticated request is turned away without rendering, and a
 * signed-out visitor gets a sign-in redirect rather than a bare error.
 *
 * Rate limiting used to live here and no longer does: it kept module-scope mutable
 * state across invocations, marked itself initialised before its async setup finished,
 * and derived the client IP from the first `x-forwarded-for` entry — which the caller
 * supplies. See `src/lib/rate-limit/`, where it now sits detached.
 */
async function signedIn(request: NextRequest) {
  if (!process.env.NEXTAUTH_SECRET) {
    console.error("NEXTAUTH_SECRET is not configured — refusing portal access");
    return null;
  }
  return getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
}

function toSignIn(request: NextRequest, pathname: string) {
  const url = new URL("/signin", request.url);
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
}

/**
 * `/2022/05/27/some-post` — the dated permalink shape of the WordPress site this
 * domain used to serve. Bing is still working through that index years on, and a 404
 * invites it to keep trying: 404 means "not here right now", 410 means "gone, stop
 * asking", and crawlers retire a 410 far sooner. Nothing this app serves begins with a
 * four-digit year, so the shape is unambiguous.
 */
const DEAD_PERMALINK = /^\/\d{4}\/\d{1,2}\/\d{1,2}\//;

/** Exported so the rule is tested against real paths, not against this file's text. */
export const isDeadPermalink = (pathname: string) => DEAD_PERMALINK.test(pathname);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isDeadPermalink(pathname)) {
    return new NextResponse(null, { status: 410 });
  }

  const guarded = pathname.startsWith("/admin") || pathname.startsWith("/org");
  if (!guarded) return NextResponse.next();

  try {
    const token = await signedIn(request);
    if (!token) return toSignIn(request, pathname);

    // Membership is not checked here — it lives in the database and can be revoked
    // mid-session, so the org layout owns it.
    if (pathname.startsWith("/admin") && (token.platformRole ?? "USER") !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch (error) {
    console.error("Portal gate failed:", error);
    return toSignIn(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  // The portals are matched by name rather than left to the catch-all below. That
  // pattern excludes any path containing a dot — meant for static files, but it also
  // let `/admin/orders/abc.def` through with no check at all.
  matcher: [
    "/admin",
    "/admin/:path*",
    "/org",
    "/org/:path*",
    // The previous site's permalinks, answered with 410 above.
    "/:year(\\d{4})/:month(\\d{1,2})/:day(\\d{1,2})/:slug*",
  ],
};
