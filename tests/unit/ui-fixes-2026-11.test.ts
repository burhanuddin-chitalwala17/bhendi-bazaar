/**
 * Regressions from the 2026-11-04 UI audit, each a defect that shipped.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { ORDER_STATUS } from "@server/checkout/order.types";
import { orderHeadline } from "@/components/order/order-headline";
import { activeNavHref, type PortalNavItem } from "@/components/layout/PortalSidebar";

const ROOT = resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

describe("the order page headline follows the order", () => {
  const PLACED = orderHeadline(ORDER_STATUS.CONFIRMED).title;

  // It said "placed successfully" for every order, cancelled and unpaid included.
  it.each([ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.FAILED, ORDER_STATUS.EXPIRED, ORDER_STATUS.CANCELLED])(
    "does not tell a %s order it was placed",
    (status) => {
      expect(orderHeadline(status).title).not.toBe(PLACED);
    },
  );

  it("has a headline for every status", () => {
    for (const status of Object.values(ORDER_STATUS)) expect(orderHeadline(status).title).toBeTruthy();
  });
});

describe("the portal sidebar lights one item", () => {
  const item = (href: string, exact = false): PortalNavItem => ({ title: href, href, exact, icon: (() => null) as never });
  const items = [item("/admin", true), item("/admin/orders"), item("/admin/orders/pickups")];

  // /admin/orders/pickups lit both Orders and Pickups.
  it("picks the deepest match", () => {
    expect(activeNavHref(items, "/admin/orders/pickups")).toBe("/admin/orders/pickups");
    expect(activeNavHref(items, "/admin/orders/abc")).toBe("/admin/orders");
  });

  it("matches whole path segments only", () => {
    expect(activeNavHref(items, "/admin/ordersx")).toBeNull();
    expect(activeNavHref(items, "/admin")).toBe("/admin");
  });
});

describe("error boundaries refetch", () => {
  // In Next 16 `reset` re-renders without refetching, so "Try again" showed the same error.
  const boundaries = walk(join(ROOT, "src/app")).filter((p) => /(^|\/)(global-)?error\.tsx$/.test(p));

  it("scans the boundaries", () => {
    expect(boundaries.length).toBeGreaterThan(5);
  });

  it.each(boundaries.map((p) => relative(ROOT, p)))("%s uses retry, not reset", (path) => {
    expect(readFileSync(join(ROOT, path), "utf8")).not.toMatch(/\breset\b/);
  });
});
