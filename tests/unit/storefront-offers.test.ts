/**
 * Which of a shop's offers its deals section shows, and what each says (storefront-themes D10;
 * R7, A3, A6; Q12, Q13, Q20, Q36, Q41). Copy is derived from the offer, so a typed "50% off"
 * cannot sit over a 10% offer; a code is printed only when the shop ticked it.
 */
import { describe, expect, it } from "vitest";
import { storefrontOffers, type StorefrontOfferRow } from "@server/promotions/storefront-offers";

// Sun 1 Nov 2026, 12:00 IST.
const NOW = new Date("2026-11-01T06:30:00Z");
const HOUR = 3_600_000;

const offer = (overrides: Partial<StorefrontOfferRow> = {}): StorefrontOfferRow => ({
  id: "p1",
  label: "Diwali sale",
  scope: "ORG",
  orgId: "org-1",
  trigger: "AUTOMATIC",
  code: null,
  valueType: "PERCENT",
  percentBps: 2000,
  amountOffPaise: null,
  fixedPricePaise: null,
  maxDiscountPaise: null,
  minSubtotalPaise: 0,
  startsAt: new Date(NOW.getTime() - HOUR),
  // Tue 3 Nov 2026, 18:00 IST.
  endsAt: new Date("2026-11-03T12:30:00Z"),
  isActive: true,
  usageLimit: null,
  usageCount: 0,
  perUserLimit: null,
  platformBudgetPaise: null,
  platformSpentPaise: 0,
  showOnStorefront: false,
  targets: [{ categoryName: "Sarees", productName: null }],
  ...overrides,
});

const run = (rows: StorefrontOfferRow[], ceilingBps: number | null = null) =>
  storefrontOffers(rows, { now: NOW, ceilingBps });

describe("storefront offers: what shows (R7, Q12, Q20)", () => {
  it("shows a running automatic offer, worded from the offer (Q13)", () => {
    expect(run([offer()])).toEqual([
      { id: "p1", title: "Diwali sale", headline: "20% off · All Sarees", ends: "Ends Tue 3 Nov", code: null, fewLeft: false },
    ]);
  });

  it("prints a code only when the shop ticked Show on my shop (Q20)", () => {
    const coupon = { trigger: "CODE" as const, code: "NOOR-DIWALI100", valueType: "AMOUNT_OFF" as const, percentBps: null, amountOffPaise: 10_000, minSubtotalPaise: 99_900, targets: [] };
    expect(run([offer(coupon)])).toEqual([]);
    expect(run([offer({ ...coupon, showOnStorefront: true })])).toEqual([
      expect.objectContaining({ headline: "₹100 off orders over ₹999", code: "NOOR-DIWALI100" }),
    ]);
  });

  it("drops an ended, stopped, not-yet-started or used-up offer (A6)", () => {
    expect(run([offer({ endsAt: NOW })])).toEqual([]);
    expect(run([offer({ isActive: false })])).toEqual([]);
    expect(run([offer({ startsAt: new Date(NOW.getTime() + HOUR) })])).toEqual([]);
    expect(
      run([offer({ trigger: "CODE", code: "NOOR-X", showOnStorefront: true, usageLimit: 50, usageCount: 50 })]),
    ).toEqual([]);
  });

  it("does not card a sale price: the strip shows it with its badge (Q41)", () => {
    expect(run([offer({ valueType: "FIXED_PRICE", percentBps: null, fixedPricePaise: 49_900 })])).toEqual([]);
  });

  it("lists the soonest ending first", () => {
    const later = offer({ id: "later", endsAt: new Date("2026-11-20T00:00:00Z") });
    const sooner = offer({ id: "sooner" });
    expect(run([later, sooner]).map((o) => o.id)).toEqual(["sooner", "later"]);
  });
});

describe("storefront offers: the words (Q13, Q36, A3)", () => {
  it("says Ends today on its last day, by India's clock", () => {
    expect(run([offer({ endsAt: new Date(NOW.getTime() + 5 * HOUR) })])[0].ends).toBe("Ends today");
  });

  it("an offer ending at midnight ends the day before", () => {
    // 00:00 IST on Wed 4 Nov is the first instant it is over.
    expect(run([offer({ endsAt: new Date("2026-11-03T18:30:00Z") })])[0].ends).toBe("Ends Tue 3 Nov");
  });

  it("flags Few left at ten uses or fewer, never with a count (Q36)", () => {
    const code = { trigger: "CODE" as const, code: "NOOR-FEW", showOnStorefront: true, usageLimit: 100 };
    expect(run([offer({ ...code, usageCount: 89 })])[0].fewLeft).toBe(false);
    expect(run([offer({ ...code, usageCount: 90 })])[0].fewLeft).toBe(true);
    expect(JSON.stringify(run([offer({ ...code, usageCount: 90 })]))).not.toMatch(/\b10\b/);
  });

  it("reads a percentage no deeper than the shop's ceiling, as the engine clamps it (A3)", () => {
    expect(run([offer({ percentBps: 4000 })], 2500)[0].headline).toBe("25% off · All Sarees");
  });

  it("says each item for an automatic amount, and names a coupon's cap", () => {
    expect(run([offer({ valueType: "AMOUNT_OFF", percentBps: null, amountOffPaise: 5_000, targets: [] })])[0].headline).toBe("₹50 off each");
    const capped = offer({ trigger: "CODE", code: "NOOR-CAP", showOnStorefront: true, maxDiscountPaise: 20_000, targets: [] });
    expect(run([capped])[0].headline).toBe("20% off up to ₹200");
  });

  it("names at most two targets", () => {
    const targets = [
      { categoryName: "Sarees", productName: null },
      { categoryName: null, productName: "Red Silk Dupatta" },
      { categoryName: null, productName: "Blue Kurta" },
    ];
    expect(run([offer({ targets })])[0].headline).toBe("20% off · All Sarees, Red Silk Dupatta +1 more");
  });
});
