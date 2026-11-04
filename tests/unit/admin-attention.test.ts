// The admin's "Needs attention" (design-system Q31): nothing at zero, a buyer's money first, five
// at most, each with its one place to resolve it; and the sales change figure (Q30).
import { describe, expect, it } from "vitest";
import { adminAttentionItems } from "@server/analytics/attention.service";
import { compare } from "@server/analytics/sales.service";
import { ADMIN_ATTENTION, type AdminAttentionCounts } from "@server/analytics/attention.types";

const at = new Date("2026-11-02T08:00:00Z");
const quiet = (): AdminAttentionCounts => ({
  refunds: { count: 0, buyers: 0, amountPaise: 0, oldestAt: null },
  parcelsToBook: { count: 0, oldestAt: null },
  payouts: { shops: 0, amountPaise: 0, oldestAt: null },
  courierConflicts: { count: 0, oldestAt: null },
});

describe("the admin's needs-attention queue", () => {
  it("is empty — the all-clear — when every count is zero", () => {
    expect(adminAttentionItems(quiet())).toEqual([]);
  });

  it("shows an item only above zero, with what waits on it and where it is resolved", () => {
    const items = adminAttentionItems({ ...quiet(), refunds: { count: 3, buyers: 2, amountPaise: 45_000, oldestAt: at } });
    expect(items).toEqual([
      { key: ADMIN_ATTENTION.REFUNDS, count: 3, waiting: { buyers: 2, amountPaise: 45_000 }, oldestAt: at.toISOString(), href: "/admin/orders/refunds" },
    ]);
  });

  it("orders a buyer's money, a buyer's parcel, a shop's money, then the rest", () => {
    const items = adminAttentionItems({
      refunds: { count: 1, buyers: 1, amountPaise: 1, oldestAt: at },
      parcelsToBook: { count: 2, oldestAt: at },
      payouts: { shops: 3, amountPaise: 9, oldestAt: at },
      courierConflicts: { count: 4, oldestAt: at },
    });
    expect(items.map((i) => [i.key, i.href])).toEqual([
      [ADMIN_ATTENTION.REFUNDS, "/admin/orders/refunds"],
      [ADMIN_ATTENTION.PARCELS_TO_BOOK, "/admin/orders/pickups?tab=ready"],
      [ADMIN_ATTENTION.PAYOUTS, "/admin/payouts"],
      [ADMIN_ATTENTION.COURIER_CONFLICTS, "/admin/orders/pickups?tab=conflicts"],
    ]);
    expect(items.length).toBeLessThanOrEqual(5);
  });
});

describe("the change figure", () => {
  it("is basis points, rounded half away from zero, and null with nothing before", () => {
    expect(compare(120_008, 50_003).changeBps).toBe(14_000);
    expect(compare(1, 3).changeBps).toBe(-6_667);
    expect(compare(5, 0).changeBps).toBeNull();
  });
});
