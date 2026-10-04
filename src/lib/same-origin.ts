import { appUrl } from "@server/shared/app-url";
import type { ApiErrorBody } from "@/lib/api-error";

/**
 * Is this request a mutation of our API sent from somewhere other than our own origin?
 *
 * A browser attaches `Origin` to every POST, PUT, PATCH and DELETE it sends, and a page on
 * another site cannot forge or remove it. So a mutation to `/api/**` whose `Origin` is not
 * ours — or that carries none — was not made by our pages, and is refused before it reaches
 * a handler (ADR-0060). Pure, so it is tested without Next: `tests/unit/same-origin.test.ts`.
 *
 * Runs on the edge, so this file imports nothing that reaches Prisma.
 */

export const MUTATING_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Mutations a caller outside this origin legitimately sends. The webhooks are named in
 * `EXTERNALLY_CALLED` (tests/unit/route-reachability.test.ts) and authenticate by signature;
 * `/api/auth/` is NextAuth's, which carries its own CSRF token.
 */
export const ORIGIN_CHECK_EXEMPT = [
  "/api/webhooks/razorpay",
  "/api/webhooks/shipping/shiprocket",
  "/api/auth/",
] as const;

/** The 403 body, in the one error envelope (docs/CONTRACTS.md). */
export const CROSS_SITE_REFUSED: ApiErrorBody = { error: "Cross-site request refused" };

/** The slice of a request this needs — `NextRequest` and `Request` both satisfy it. */
export interface OriginCheckRequest {
  method: string;
  url: string;
  headers: Pick<Headers, "get">;
}

/** A forwarding header may hold a comma-separated chain; the first entry is the client-facing one. */
const first = (value: string | null): string | null => value?.split(",")[0].trim() || null;

const isExempt = (pathname: string) =>
  ORIGIN_CHECK_EXEMPT.some((path) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path || pathname.startsWith(`${path}/`),
  );

/**
 * The origins this request may legitimately come from. Behind the host's proxy the server
 * sees an internal URL while the browser addressed the public one, which arrives in
 * `x-forwarded-host` / `x-forwarded-proto` — the same pair Next reads for Server Actions.
 * The configured app origin is admitted too, derived the way every outbound link is.
 */
export function ownOrigins(request: OriginCheckRequest): Set<string> {
  const url = new URL(request.url);
  const origins = new Set([url.origin]);

  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  if (host) {
    const proto = first(request.headers.get("x-forwarded-proto")) ?? url.protocol.replace(/:$/, "");
    origins.add(`${proto}://${host}`);
  }

  try {
    origins.add(new URL(appUrl()).origin);
  } catch {
    // Unset means no configured origin to add; the request's own origin still counts.
  }

  return origins;
}

/** Where the browser says the request came from: `Origin`, else the `Referer`'s origin. */
function claimedOrigin(headers: Pick<Headers, "get">): string | null {
  const origin = headers.get("origin");
  if (origin) return origin;
  const referer = headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function isCrossSiteMutation(request: OriginCheckRequest): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return false;

  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/") || isExempt(pathname)) return false;

  // The browser's own verdict, where it gives one. It cannot be set by a page.
  if (request.headers.get("sec-fetch-site") === "same-origin") return false;

  const origin = claimedOrigin(request.headers);
  if (!origin) return true;
  return !ownOrigins(request).has(origin);
}
