/**
 * A portal is gated by its layout, not by the edge.
 *
 * Thirteen admin pages once carried no guard of their own, on the stated assumption
 * that middleware had already checked. It had not: the catch-all matcher excludes any
 * path containing a dot, so `/admin/orders/abc.def` rendered unauthenticated. A layout
 * runs for every page beneath it and can reach the database, which is why the check
 * belongs there (ADR-0021 — a JWT claim outlives the account being demoted).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isDeadPermalink } from "@/middleware";

const ADMIN_LAYOUT = "src/app/(admin)/admin/layout.tsx";
const ORG_LAYOUT = "src/app/(org)/org/[orgId]/layout.tsx";
const MIDDLEWARE = "src/middleware.ts";

describe("portal layouts own their guard", () => {
  it("the admin layout re-reads the row, not just the session", () => {
    const source = readFileSync(ADMIN_LAYOUT, "utf8");
    expect(source).toContain("requirePlatformAdmin");
  });

  it("the org layout establishes membership", () => {
    expect(readFileSync(ORG_LAYOUT, "utf8")).toContain("requireOrgMember");
  });

  // requireSession alone proves someone is signed in, not that they are an admin.
  it("the admin layout does not settle for requireSession alone", () => {
    const source = readFileSync(ADMIN_LAYOUT, "utf8");
    const usesSessionOnly =
      source.includes("requireSession") && !source.includes("requirePlatformAdmin");
    expect(usesSessionOnly).toBe(false);
  });
});

describe("the edge gate names the portals explicitly", () => {
  const source = readFileSync(MIDDLEWARE, "utf8");
  const matcher = source.slice(source.indexOf("matcher:"));

  it("matches /admin and /org by name", () => {
    for (const path of ["/admin", "/admin/:path*", "/org", "/org/:path*"]) {
      expect(matcher).toContain(`"${path}"`);
    }
  });

  // The catch-all excluded `.*\..*` so a dot anywhere in the path skipped the gate.
  it("does not gate a portal through a dot-excluding catch-all", () => {
    expect(matcher).not.toContain("\\\\..*");
  });

  // Scanned with comments stripped: the file explains in prose why these left, and
  // that explanation must not be what makes the test pass or fail.
  it("keeps rate limiting out of the request gate", () => {
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("Ratelimit");
    expect(code).not.toContain("x-forwarded-for");
    expect(code).not.toContain("@upstash");
  });
});

/**
 * The domain served a WordPress site before this one, and Bing is still working
 * through that index. A 404 invites a retry; 410 tells a crawler to retire the URL.
 */
describe("the previous site's permalinks are gone, not missing", () => {
  it("recognises the dated permalink shape", () => {
    for (const path of [
      "/2022/07/13/operation-among-the-bb-guns",
      "/2021/08/05/daftar-19-nama-situs-judi-slot-online-gacor",
      "/2021/8/5/unpadded-date",
      "/2019/11/28/explore-bhendi-bazaar",
    ]) {
      expect(isDeadPermalink(path), path).toBe(true);
    }
  });

  // Nothing this app serves begins with a four-digit year, and nothing that does
  // should ever start doing so without this test objecting.
  it("leaves every real route alone", () => {
    for (const path of [
      "/",
      "/s",
      "/cart",
      "/checkout",
      "/signin",
      "/product/emerald-satin-abaya",
      "/category/abayas",
      "/order/order-1",
      "/orders",
      "/admin",
      "/admin/banners",
      "/org/org-1/products",
      "/api/admin/banners",
    ]) {
      expect(isDeadPermalink(path), path).toBe(false);
    }
  });

  it("does not fire on a year-like segment that is not a date path", () => {
    expect(isDeadPermalink("/category/2022")).toBe(false);
    expect(isDeadPermalink("/2022")).toBe(false);
    expect(isDeadPermalink("/2022/07")).toBe(false);
  });
});
