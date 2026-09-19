/**
 * An org's public address, and the rules around changing it (ADR-0030 decision 4).
 *
 * Pure and Prisma-free, like `product.visibility.ts`: the repository asks these
 * questions, this module answers them. Generation reuses `slugCandidates`, so a handle
 * and a product slug cannot drift into two ideas of what a URL-safe name is.
 *
 * The hold is **derived**, never stored as a flag or cleaned up by a job: a retired
 * handle is unavailable while `retiredAt` is inside the window and free after, which is
 * true whenever it is asked rather than whenever something last ran (ADR-0023's shape).
 */

import { slugCandidates } from "@server/shared/slug";

/**
 * How long a retired handle keeps redirecting and stays unavailable.
 *
 * A setting rather than a literal because it is the only thing standing between a
 * printed card and a customer arriving at a *different* shop, and that balance will be
 * retuned (ADR-0030). Env-overridable so it can move without a deploy of new code.
 */
export const HANDLE_HOLD_DAYS = Number(process.env.ORG_HANDLE_HOLD_DAYS ?? 180);

/** Paths the platform serves, or plausibly will. A handle may never be one. */
const RESERVED = new Set([
  // live route segments
  "admin",
  "api",
  "org",
  "store",
  "product",
  "category",
  "cart",
  "checkout",
  "orders",
  "order",
  "profile",
  "wishlist",
  "bid",
  "signin",
  "signup",
  "s",
  "forgot-password",
  "reset-password",
  // things a platform grows into, cheap to reserve now and impossible later
  "about",
  "help",
  "support",
  "contact",
  "terms",
  "privacy",
  "policies",
  "blog",
  "search",
  "new",
  "settings",
  "account",
  "login",
  "logout",
  "register",
  "sitemap",
  "robots",
  "favicon",
  "static",
  "assets",
  "public",
  "www",
  "mail",
]);

export const isReservedHandle = (handle: string) => RESERVED.has(handle);

/**
 * Candidate handles for a name, in preference order.
 *
 * Yields the bare slug, then -2, -3, … exactly as product slugs do — the caller
 * attempts the insert and advances on a unique violation rather than asking whether a
 * handle is free, because that question's answer is stale before it is used.
 * A reserved word is skipped rather than suffixed: `admin-2` reads as a platform page.
 */
export function* handleCandidates(name: string): Generator<string> {
  for (const candidate of slugCandidates(name, "shop")) {
    if (isReservedHandle(candidate)) continue;
    yield candidate;
  }
}

/** The instant before which a retirement no longer holds its handle. */
export function holdCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - HANDLE_HOLD_DAYS * 24 * 60 * 60 * 1000);
}

/** A retirement still inside the window holds its handle and still redirects. */
export function isHeld(retiredAt: Date, now: Date = new Date()): boolean {
  return retiredAt > holdCutoff(now);
}

/** When a retirement's hold ends — what an owner is shown before confirming a change. */
export function holdExpiresAt(retiredAt: Date): Date {
  return new Date(retiredAt.getTime() + HANDLE_HOLD_DAYS * 24 * 60 * 60 * 1000);
}
