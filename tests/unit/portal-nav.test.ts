/**
 * The shop portal's one navigation list (own-store onboarding D1, D2). A page the list forgets is
 * a page a phone user cannot reach without typing a URL, so the routes are read from disk.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MORE_TAB,
  PORTAL_GROUPS,
  PORTAL_NAV,
  activePortalEntry,
  activeTabKey,
  portalHref,
} from "@/components/layout/portal-nav";

const ORG_ROOT = "src/app/(org)/org/[orgId]";
const ORG = "o1";

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return pages(path);
    return entry === "page.tsx" ? [path] : [];
  });
}

/** Each page as the URL a seller would land on, with dynamic segments filled. */
const ROUTES = pages(ORG_ROOT).map((file) => {
  const rel = relative(ORG_ROOT, file).split(sep).slice(0, -1).join("/");
  const filled = rel.replace(/\[[^\]]+\]/g, "x");
  return filled ? `/org/${ORG}/${filled}` : `/org/${ORG}`;
});

describe("PORTAL_NAV", () => {
  it("finds the portal's pages it guards", () => {
    expect(ROUTES.length).toBeGreaterThan(20);
  });

  it("puts every portal page under exactly one navigation item (spec R6, A3)", () => {
    const orphans = ROUTES.filter((route) => activePortalEntry(ORG, route) === null);
    expect(orphans).toEqual([]);
  });

  it("has four tabs, then More, in the design-system order: money and buyers before the shop", () => {
    expect(PORTAL_NAV.filter((e) => e.tab).map((e) => e.tabLabel ?? e.label)).toEqual(["Home", "Products", "Orders", "Earnings"]);
  });

  it("lights one tab on every page — its own, its section's, or More (spec A3)", () => {
    expect(activeTabKey(ORG, `/org/${ORG}`)).toBe("home");
    expect(activeTabKey(ORG, `/org/${ORG}/orders/x`)).toBe("orders");
    expect(activeTabKey(ORG, `/org/${ORG}/earnings`)).toBe("earnings");
    expect(activeTabKey(ORG, `/org/${ORG}/locations`)).toBe(MORE_TAB);
    expect(activeTabKey(ORG, `/org/${ORG}/channels/x/listings`)).toBe(MORE_TAB);
  });

  it("marks Shop details, not the Shop hub, on /shop/details", () => {
    expect(activePortalEntry(ORG, `/org/${ORG}/shop/details`)?.key).toBe("details");
    expect(activePortalEntry(ORG, `/org/${ORG}/shop`)?.key).toBe("shop");
  });

  it("gives every item a one-line purpose (spec R5)", () => {
    const blank = PORTAL_NAV.filter((e) => !e.purpose.trim() || e.purpose.includes("\n"));
    expect(blank).toEqual([]);
  });

  it("files every non-tab item under one of the five groups (Q9)", () => {
    expect(PORTAL_GROUPS).toHaveLength(5);
    const loose = PORTAL_NAV.filter((e) => !e.tab && !e.group);
    expect(loose).toEqual([]);
  });

  it("places Photos under Sell, Channels and Bidding under Grow (Q22)", () => {
    const groupOf = (key: string) => PORTAL_NAV.find((e) => e.key === key)?.group;
    expect([groupOf("library"), groupOf("channels"), groupOf("bidding")]).toEqual(["sell", "grow", "grow"]);
  });

  it("uses the renamed labels (Q7)", () => {
    const labels = PORTAL_NAV.map((e) => e.label);
    expect(labels).toEqual(expect.arrayContaining(["Home", "Shop page", "Pickup addresses", "Money you'll receive", "Photos", "Brands and defaults"]));
    expect(labels).not.toEqual(expect.arrayContaining(["Dashboard", "Storefront", "Locations", "Earnings", "Library", "What you sell"]));
  });

  it("builds each href from the shop it is given", () => {
    const shop = PORTAL_NAV.find((e) => e.key === "details")!;
    expect(portalHref(shop, ORG)).toBe(`/org/${ORG}/shop/details`);
    expect(portalHref(PORTAL_NAV.find((e) => e.key === "help")!, ORG)).toBeNull();
  });
});
