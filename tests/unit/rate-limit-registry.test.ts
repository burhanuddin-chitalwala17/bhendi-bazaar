/**
 * Every public route handler is classified for rate limiting (rate-limiting R8, D10, ADR-0063).
 *
 * Limits used to be added handler by handler, so a route nobody thought about had none. This
 * reads the route tree, not the registry's own claims: each exported method under
 * `src/app/api/**` outside the two portals must have an entry in `src/lib/rate-limit/registry.ts`,
 * every entry must name a method that exists, and a limited route must call the limiter with
 * its own key. Exempting a route is allowed and costs a reason sentence.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ROUTE_RATE_LIMITS } from "@/lib/rate-limit/registry";
import { POLICY_BUDGETS } from "@/lib/rate-limit/policies";

const ROOT = resolve(__dirname, "../..");
const API = join(ROOT, "src/app/api");
/** Behind `requirePlatformAdmin` and `withOrg`, which portal-boundary holds (decisions Q15). */
const PORTALS = ["src/app/api/admin/", "src/app/api/org/"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : /\/route\.tsx?$/.test(path) ? [path] : [];
  });
}

/** The methods a route file exports, in each of the three shapes Next accepts. */
function exportedMethods(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Z]+)\b/g)) found.add(m[1]);
  for (const block of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of block[1].split(",")) found.add(part.trim().split(/\s+as\s+/).at(-1) ?? "");
  }
  return [...found].filter((name) => METHODS.includes(name));
}

const routeFiles = walk(API)
  .map((file) => relative(ROOT, file))
  .filter((file) => !PORTALS.some((portal) => file.startsWith(portal)));

const urlOf = (file: string) => "/" + file.replace(/^src\/app\//, "").replace(/\/route\.tsx?$/, "");

/** `"POST /api/auth/signup"` → the file that serves it. */
const publicRoutes = new Map<string, string>(
  routeFiles.flatMap((file) =>
    exportedMethods(readFileSync(join(ROOT, file), "utf8")).map(
      (method) => [`${method} ${urlOf(file)}`, file] as [string, string],
    ),
  ),
);

const registry = ROUTE_RATE_LIMITS as Record<string, { policy?: string; enforcedIn?: string; exempt?: string }>;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("every public route is classified for rate limiting", () => {
  it("the scan reaches the routes it claims to check", () => {
    // A broken glob yields no routes and an empty offender list, which passes. The floor
    // makes the two outcomes distinguishable.
    expect(routeFiles.length).toBeGreaterThan(25);
    expect(publicRoutes.size).toBeGreaterThan(40);
    expect(publicRoutes.has("POST /api/auth/signup")).toBe(true);
    expect(publicRoutes.has("GET /api/auth/[...nextauth]")).toBe(true);
    expect([...publicRoutes.keys()].some((route) => route.includes("/api/admin/"))).toBe(false);
  });

  it("an unclassified public route fails, naming where to classify it (spec A6)", () => {
    const unclassified = [...publicRoutes.keys()].filter((route) => !(route in registry));
    expect(
      unclassified,
      "Classify each in src/lib/rate-limit/registry.ts: a policy, or { exempt: <why> }",
    ).toEqual([]);
  });

  it("every registry entry names a method a route actually exports", () => {
    expect(Object.keys(registry).filter((route) => !publicRoutes.has(route))).toEqual([]);
  });

  it("a limited route calls the limiter with its own key", () => {
    const silent = Object.entries(registry)
      .filter(([, entry]) => entry.policy)
      .filter(([route, entry]) => {
        const file = entry.enforcedIn ?? publicRoutes.get(route);
        if (!file || !existsSync(join(ROOT, file))) return true;
        const call = new RegExp(`(?:limitRequest|checkRateLimit)\\([^;]*?"${escape(route)}"`);
        return !call.test(readFileSync(join(ROOT, file), "utf8"));
      })
      .map(([route]) => route);
    expect(silent).toEqual([]);
  });

  it("a limited route keys by the account when there is one (spec R7)", () => {
    // Address-only by nature: no signed-in caller exists there. Everything else passes
    // `userId`, or buyers behind one carrier address share a budget.
    const ANONYMOUS: Record<string, string> = {
      "POST /api/auth/[...nextauth]": "Signing in: there is no account until it succeeds.",
      "POST /api/auth/signup": "Creating the account.",
      "POST /api/auth/forgot-password": "Signed out by definition.",
      "POST /api/auth/reset-password": "Holds a reset token, not a session.",
      "GET /api/auth/verify-email": "An email link, opened with or without a session.",
      "POST /api/orders/lookup": "The guest's way in; a signed-in buyer has their orders page.",
    };
    const addressOnly = Object.entries(registry)
      .filter(([route, entry]) => entry.policy && !(route in ANONYMOUS))
      .filter(([route, entry]) => {
        const file = entry.enforcedIn ?? publicRoutes.get(route);
        const call = new RegExp(`(?:limitRequest|checkRateLimit)\\([^;]*?"${escape(route)}"[^;]*?\\buserId\\b`);
        return !file || !call.test(readFileSync(join(ROOT, file), "utf8"));
      })
      .map(([route]) => route);
    expect(Object.keys(ANONYMOUS).every((route) => registry[route]?.policy)).toBe(true);
    expect(addressOnly, "Read the session first and pass { userId } to the limiter").toEqual([]);
  });

  it("every policy used has a budget, and every exemption says why", () => {
    for (const [route, entry] of Object.entries(registry)) {
      if (entry.policy) expect(POLICY_BUDGETS, route).toHaveProperty([entry.policy]);
      else expect(entry.exempt?.length ?? 0, route).toBeGreaterThan(30);
    }
  });

  it("only the seam reaches the store", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
      });
    const offenders = [...sources(join(ROOT, "src")), ...sources(join(ROOT, "server"))]
      .map((file) => relative(ROOT, file))
      .filter((file) => !file.startsWith("src/lib/rate-limit/"))
      .filter((file) => /from\s+["']@upstash\//.test(readFileSync(join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
