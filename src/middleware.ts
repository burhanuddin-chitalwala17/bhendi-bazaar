import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { contentSecurityPolicy, isSelfFramedPath } from "@/lib/security-headers";
import { CROSS_SITE_REFUSED, isCrossSiteMutation } from "@/lib/same-origin";
import { forwardStorefrontShop } from "@/lib/storefront-chrome";

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
 * asking", and crawlers retire a 410 far sooner. The other WordPress shapes (`/wp-*`,
 * `/feed`, `/tag/`, `/author/`) go too. `/category/` cannot: this app serves it.
 */
const DEAD_PERMALINK =
  /^\/(\d{4}\/\d{1,2}\/\d{1,2}\/|wp-|xmlrpc\.php|(comments\/)?feed(\/|$)|tag\/|author\/)/;

/** Exported so the rule is tested against real paths, not against this file's text. */
export const isDeadPermalink = (pathname: string) => DEAD_PERMALINK.test(pathname);

/**
 * Whether a signed-out visitor is sent to the sign-in page. `/org/new` is the one portal path
 * that is not: it asks in place with the sign-in sheet and returns there (onboarding D4).
 * It holds no data and its page still runs `requireSession` before showing the form.
 */
export const signInAtEdge = (pathname: string) =>
  (pathname.startsWith("/admin") || pathname.startsWith("/org")) && pathname !== "/org/new";

/**
 * A fresh nonce per response, carried both ways: on the *request* so Next stamps it onto
 * the inline scripts it renders, and on the response so the browser enforces it. Reusing
 * one across responses would make it guessable and therefore no better than
 * `unsafe-inline` (src/lib/security-headers.ts).
 */
function withCsp(request: NextRequest, response: NextResponse): NextResponse {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
    isSelfFramedPath(request.nextUrl.pathname),
  );
  const header = process.env.CSP_REPORT_ONLY === "1"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);
  response.headers.set(header, policy);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isDeadPermalink(pathname)) {
    return new NextResponse(null, { status: 410 });
  }

  // A mutation of our API from another site stops here (ADR-0060). The body is the error
  // envelope by shape, built directly: `toErrorResponse` would pull zod and the server's
  // constraint module into the edge bundle to produce one constant.
  if (isCrossSiteMutation(request)) {
    return NextResponse.json(CROSS_SITE_REFUSED, { status: 403 });
  }

  // A product reached from a themed shop keeps its chrome (storefront-themes Q33).
  forwardStorefrontShop(request.headers, request.nextUrl);

  // Rebuilt with the mutated headers so the nonce reaches the render, not just the client.
  const proceed = () =>
    withCsp(request, NextResponse.next({ request: { headers: request.headers } }));

  if (!signInAtEdge(pathname)) return proceed();

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

  return proceed();
}

export const config = {
  // The portals are matched by name rather than left to the catch-all below. That
  // pattern excludes any path containing a dot — meant for static files, but it also
  // let `/admin/orders/abc.def` through with no check at all.
  // Everything except build output and the files a browser fetches by fixed name. The
  // portals were matched by name when the gate was all this did; the CSP has to reach
  // every document, so the catch-all is now the matcher and `startsWith` in the handler
  // does the routing. Note what is NOT excluded: paths containing a dot. The conventional
  // `(?!.*\\.)` exclusion is meant for static files, but it also let
  // `/admin/orders/abc.def` through with no check at all.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
