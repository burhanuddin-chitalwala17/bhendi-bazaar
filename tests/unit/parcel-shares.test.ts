/**
 * order-fulfilment U5 arithmetic without a database: a parcel's net lines, its share of an offer's
 * budget (D13, Q33) and its refund owed (D16, Q11), over random splits. The failure each guards:
 * a paisa created or lost when one line or one charge is split across parcels, and an order's
 * refunds summing past what the gateway captured.
 */
import { describe, expect, it } from "vitest";
import {
  budgetSharesFor,
  cumulativeFloorShares,
  parcelShares,
  refundOwedPaise,
  type ShareLine,
  type ShareParcel,
} from "@server/checkout/parcel-shares";

/** A seeded generator, so a failure names the case that broke. */
function rng(seed: number) {
  let s = seed;
  return (n: number) => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s % n;
  };
}

function randomOrder(seed: number) {
  const r = rng(seed);
  const lineCount = 1 + r(4);
  const lines: ShareLine[] = Array.from({ length: lineCount }, (_, i) => {
    const quantity = 1 + r(6);
    const unitPrice = 100 + r(99_900);
    const discountPaise = r(unitPrice * quantity);
    return { orderItemId: `item${i}`, quantity, unitPrice, discountPaise, orgFundedPaise: r(discountPaise + 1) };
  });
  const orgs = ["orgA", "orgB"];
  const parcelCount = 1 + r(4);
  const parcels: ShareParcel[] = Array.from({ length: parcelCount }, (_, i) => ({
    id: `p${i}`, code: `BB-1-SH${i + 1}`, orgId: orgs[i % 2], shippingCost: r(10_000), items: [],
  }));
  // Every unit of every line goes to some parcel, split at random.
  for (const line of lines) {
    let left = line.quantity;
    while (left > 0) {
      const q = 1 + r(left);
      const p = parcels[r(parcels.length)];
      const existing = p.items.find((i) => i.orderItemId === line.orderItemId);
      if (existing) existing.quantity += q;
      else p.items.push({ orderItemId: line.orderItemId, quantity: q });
      left -= q;
    }
  }
  return { lines, parcels, r };
}

describe("parcel shares are exact parts (order-fulfilment D13, D16)", () => {
  it("cumulative floors sum to the total, whatever the weights", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      const weights = Array.from({ length: 1 + r(6) }, () => r(5_000));
      const total = r(1_000_000);
      const shares = cumulativeFloorShares(total, weights);
      expect(shares.reduce((a, b) => a + b, 0), `seed ${seed}`).toBe(total);
      expect(shares.every((s) => s >= 0)).toBe(true);
    }
  });

  it("parcels' net lines sum to the order's lines less their discount, over random splits", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { lines, parcels } = randomOrder(seed);
      const shares = parcelShares(lines, parcels);
      const net = [...shares.values()].reduce((s, p) => s + p.netItemsPaise, 0);
      const platform = [...shares.values()].reduce((s, p) => s + p.platformFundedPaise, 0);
      expect(net, `seed ${seed}`).toBe(lines.reduce((s, l) => s + l.unitPrice * l.quantity - l.discountPaise, 0));
      expect(platform, `seed ${seed}`).toBe(lines.reduce((s, l) => s + l.discountPaise - l.orgFundedPaise, 0));
    }
  });

  it("Q33: an offer's budget charge splits over its shop's parcels with nothing created or lost", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { lines, parcels, r } = randomOrder(seed);
      const shares = parcelShares(lines, parcels);
      const charges = [
        { promotionId: "promo1", orgId: "orgA", budgetChargedPaise: r(50_000) },
        { promotionId: "promo1", orgId: "orgB", budgetChargedPaise: r(50_000) },
      ];
      const released = parcels.reduce((sum, p) => sum + (budgetSharesFor(p.id, charges, parcels, shares).get("promo1") ?? 0), 0);
      const chargedOnShopsWithParcels = charges
        .filter((c) => parcels.some((p) => p.orgId === c.orgId))
        .reduce((s, c) => s + c.budgetChargedPaise, 0);
      expect(released, `seed ${seed}`).toBe(chargedOnShopsWithParcels);
    }
  });

  it("Q11: refunds owed, parcel by parcel in any order, never pass what was captured", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { lines, parcels, r } = randomOrder(seed);
      const shares = parcelShares(lines, parcels);
      const full = parcels.reduce((s, p) => s + shares.get(p.id)!.netItemsPaise + p.shippingCost, 0);
      // Captured can fall short of the sum (rounding, a hand edit): the cap is what holds.
      const grandTotal = full - r(Math.max(1, Math.floor(full / 4)));
      let owed = 0;
      for (const p of [...parcels].reverse()) {
        owed += refundOwedPaise({ netItemsPaise: shares.get(p.id)!.netItemsPaise, shippingCost: p.shippingCost, grandTotal, alreadyOwedPaise: owed });
      }
      expect(owed, `seed ${seed}`).toBeLessThanOrEqual(Math.max(0, grandTotal));
    }
  });

  it("A6: a ₹1,190 line with ₹50 shipping is owed ₹1,240, shipping included", () => {
    const lines: ShareLine[] = [{ orderItemId: "i", quantity: 1, unitPrice: 129_000, discountPaise: 10_000, orgFundedPaise: 0 }];
    const parcels: ShareParcel[] = [{ id: "p", code: "BB-1-SH1", orgId: "o", shippingCost: 5_000, items: [{ orderItemId: "i", quantity: 1 }] }];
    const share = parcelShares(lines, parcels).get("p")!;
    expect(refundOwedPaise({ netItemsPaise: share.netItemsPaise, shippingCost: 5_000, grandTotal: 124_000, alreadyOwedPaise: 0 })).toBe(124_000);
    expect(refundOwedPaise({ netItemsPaise: share.netItemsPaise, shippingCost: 5_000, grandTotal: 124_000, alreadyOwedPaise: 124_000 })).toBe(0);
  });
});
