// How a discount is decided and who pays for it (ADR-0019).
//
// Offers compete rather than stack, so every line takes the single best offer that
// covers it; the organisation always bears its own, and the platform tops up only the
// difference. The tests that matter most here are the ones asserting the *split*
// reconciles — the whole payout path reads it, and a split that does not add up is a
// settlement paid from a number nobody can justify.
import { describe, expect, it } from "vitest";
import {
  automaticUnitPrice,
  normaliseCode,
  quoteDiscounts,
} from "@server/promotions/discount-engine";
import type { DiscountableLine, EnginePromotion } from "@server/promotions/promotion.types";

const NOW = new Date("2026-08-16T12:00:00Z");
const OPEN = { startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-09-01T00:00:00Z") };

// Electronics → Audio → Headphones, plus a sibling tree for Apparel.
const PARENTS = new Map<string, string | null>([
  ["electronics", null],
  ["audio", "electronics"],
  ["headphones", "audio"],
  ["apparel", null],
]);

const promo = (o: Partial<EnginePromotion> = {}): EnginePromotion => ({
  id: "promo",
  label: "An offer",
  scope: "PLATFORM",
  orgId: null,
  trigger: "AUTOMATIC",
  code: null,
  valueType: "PERCENT",
  percentBps: 2000,
  amountOffPaise: null,
  fixedPricePaise: null,
  maxDiscountPaise: null,
  minSubtotalPaise: 0,
  isActive: true,
  usageLimit: null,
  usageCount: 0,
  perUserLimit: null,
  targets: [],
  ...OPEN,
  ...o,
});

const line = (o: Partial<DiscountableLine> = {}): DiscountableLine => ({
  key: "earbuds::::",
  productId: "earbuds",
  orgId: "abc",
  categoryId: "headphones",
  unitPrice: 200000, // ₹2,000
  quantity: 1,
  ...o,
});

const EARBUDS = line();
const KURTA = line({
  key: "kurta::::",
  productId: "kurta",
  categoryId: "apparel",
  unitPrice: 150000, // ₹1,500
});

const quote = (
  lines: DiscountableLine[],
  promotions: EnginePromotion[],
  code?: string,
  buyer: { userId?: string | null; priorRedemptions?: number } = {}
) =>
  quoteDiscounts({
    lines,
    promotions,
    categoryParents: PARENTS,
    code,
    now: NOW,
    userId: buyer.userId,
    priorRedemptions: buyer.priorRedemptions,
  });

/** Every quote must satisfy these, whatever the inputs (ADR-0019). */
function expectInternallyConsistent(result: ReturnType<typeof quote>, lines: DiscountableLine[]) {
  for (const l of result.lines) {
    const source = lines.find((x) => x.key === l.key)!;
    expect(l.orgFundedPaise + l.platformFundedPaise).toBe(l.buyerDiscountPaise);
    expect(l.orgFundedPaise).toBeGreaterThanOrEqual(0);
    expect(l.platformFundedPaise).toBeGreaterThanOrEqual(0);
    expect(l.buyerDiscountPaise).toBeLessThanOrEqual(source.unitPrice * source.quantity);
  }
  const fromLines = result.lines.reduce((s, l) => s + l.buyerDiscountPaise, 0);
  expect(result.totalDiscountPaise).toBe(fromLines);
  const fromAttributions = result.attributions.reduce((s, a) => s + a.buyerDiscountPaise, 0);
  expect(fromAttributions).toBe(fromLines);
  for (const a of result.attributions) {
    expect(a.orgFundedPaise + a.platformFundedPaise).toBe(a.buyerDiscountPaise);
  }
}

describe("competing offers and the funding split", () => {
  it("the platform tops up only the difference when it outbids the org", () => {
    // Org 15% = ₹300, platform 20% = ₹400. Buyer gets ₹400; org bears its own ₹300.
    const result = quote(
      [EARBUDS],
      [
        promo({ id: "org15", scope: "ORG", orgId: "abc", percentBps: 1500 }),
        promo({ id: "plat20", scope: "PLATFORM", percentBps: 2000 }),
      ]
    );
    const [l] = result.lines;
    expect(l.buyerDiscountPaise).toBe(40000);
    expect(l.orgFundedPaise).toBe(30000);
    expect(l.platformFundedPaise).toBe(10000);
    expect(l.winningPromotionId).toBe("plat20");
    expectInternallyConsistent(result, [EARBUDS]);
  });

  it("the platform funds nothing when the org's offer is the deeper one", () => {
    // The asymmetry: the platform tops up to a better offer, it never matches one.
    const result = quote(
      [EARBUDS],
      [
        promo({ id: "org20", scope: "ORG", orgId: "abc", percentBps: 2000 }),
        promo({ id: "plat15", scope: "PLATFORM", percentBps: 1500 }),
      ]
    );
    const [l] = result.lines;
    expect(l.buyerDiscountPaise).toBe(40000);
    expect(l.orgFundedPaise).toBe(40000);
    expect(l.platformFundedPaise).toBe(0);
    expect(l.winningPromotionId).toBe("org20");
    expectInternallyConsistent(result, [EARBUDS]);
  });

  it("gives a tie to the organisation, so no cost is misreported to the platform", () => {
    const result = quote(
      [EARBUDS],
      [
        promo({ id: "org20", scope: "ORG", orgId: "abc", percentBps: 2000 }),
        promo({ id: "plat20", scope: "PLATFORM", percentBps: 2000 }),
      ]
    );
    const [l] = result.lines;
    expect(l.platformFundedPaise).toBe(0);
    expect(l.winningPromotionId).toBe("org20");
  });

  it("discounts nothing when neither party is offering", () => {
    const result = quote([EARBUDS], []);
    expect(result.totalDiscountPaise).toBe(0);
    expect(result.lines[0].winningPromotionId).toBeNull();
    expect(result.attributions).toEqual([]);
  });

  it("never stacks — a second offer replaces the first rather than adding to it", () => {
    const result = quote(
      [EARBUDS],
      [
        promo({ id: "a", scope: "PLATFORM", percentBps: 1000 }),
        promo({ id: "b", scope: "PLATFORM", percentBps: 2500 }),
      ]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(50000); // 25%, not 35%
  });
});

describe("targeting", () => {
  it("reaches the whole subtree from an ancestor category", () => {
    const result = quote(
      [EARBUDS],
      [promo({ id: "elec", targets: [{ categoryId: "electronics", productId: null }] })]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(40000);
  });

  it("does not reach a sibling tree", () => {
    const result = quote(
      [KURTA],
      [promo({ id: "elec", targets: [{ categoryId: "electronics", productId: null }] })]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(0);
  });

  it("covers everything in scope when it names no target", () => {
    const result = quote([EARBUDS, KURTA], [promo({ id: "all" })]);
    expect(result.lines.every((l) => l.buyerDiscountPaise > 0)).toBe(true);
  });

  it("an org offer leaves another org's lines untouched", () => {
    const other = line({ key: "other::::", productId: "other", orgId: "xyz" });
    const result = quote(
      [EARBUDS, other],
      [promo({ id: "org", scope: "ORG", orgId: "abc", percentBps: 2000 })]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(40000);
    expect(result.lines[1].buyerDiscountPaise).toBe(0);
  });

  it("targets a single product without touching its category siblings", () => {
    const sibling = line({ key: "sib::::", productId: "sibling" });
    const result = quote(
      [EARBUDS, sibling],
      [promo({ id: "one", targets: [{ categoryId: null, productId: "earbuds" }] })]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(40000);
    expect(result.lines[1].buyerDiscountPaise).toBe(0);
  });
});

describe("an org's own offers compete with each other (ADR-0019 decision 1)", () => {
  // Everything an org can target — store-wide, a category, one product — on one line.
  const orgOffer = (id: string, percentBps: number, targets: EnginePromotion["targets"] = []) =>
    promo({ id, scope: "ORG", orgId: "abc", percentBps, targets });

  const EVERYTHING = orgOffer("everything", 1000);
  const CATEGORY = orgOffer("category", 2000, [{ categoryId: "electronics", productId: null }]);
  const PRODUCT = orgOffer("product", 3000, [{ categoryId: null, productId: "earbuds" }]);

  it("takes the best of store-wide, category and product — never their sum", () => {
    const result = quote([EARBUDS], [EVERYTHING, CATEGORY, PRODUCT]);
    // 10% + 20% + 30% would be ₹1,200. Competing, it is ₹600.
    expect(result.lines[0].buyerDiscountPaise).toBe(60000);
    expect(result.lines[0].winningPromotionId).toBe("product");
    expectInternallyConsistent(result, [EARBUDS]);
  });

  it("lets a category offer win when it beats the product's own", () => {
    const weakProduct = orgOffer("product", 500, [{ categoryId: null, productId: "earbuds" }]);
    const result = quote([EARBUDS], [EVERYTHING, CATEGORY, weakProduct]);
    expect(result.lines[0].buyerDiscountPaise).toBe(40000); // the category's 20%
    expect(result.lines[0].winningPromotionId).toBe("category");
  });

  it("lets a store-wide offer win when it beats both", () => {
    const result = quote(
      [EARBUDS],
      [orgOffer("everything", 4000), CATEGORY, orgOffer("product", 500, [{ categoryId: null, productId: "earbuds" }])]
    );
    expect(result.lines[0].winningPromotionId).toBe("everything");
    expect(result.lines[0].buyerDiscountPaise).toBe(80000);
  });

  it("applies each line's own best, so one order can carry two of an org's offers", () => {
    // The earbuds take the product offer; the kurta is outside the category, so it
    // falls back to the store-wide one.
    const result = quote([EARBUDS, KURTA], [EVERYTHING, CATEGORY, PRODUCT]);
    expect(result.lines[0].winningPromotionId).toBe("product");
    expect(result.lines[0].buyerDiscountPaise).toBe(60000); // 30% of ₹2,000
    expect(result.lines[1].winningPromotionId).toBe("everything");
    expect(result.lines[1].buyerDiscountPaise).toBe(15000); // 10% of ₹1,500
    expectInternallyConsistent(result, [EARBUDS, KURTA]);
  });

  it("charges the whole winning discount to the org, whichever of its offers won", () => {
    const result = quote([EARBUDS], [EVERYTHING, CATEGORY, PRODUCT]);
    expect(result.lines[0].orgFundedPaise).toBe(60000);
    expect(result.lines[0].platformFundedPaise).toBe(0);
  });

  it("still competes against the platform after picking the org's best", () => {
    // Org's best is 30% (₹600); the platform offers 40% (₹800). Buyer gets ₹800, the
    // org bears its own ₹600, and the platform tops up ₹200.
    const result = quote(
      [EARBUDS],
      [EVERYTHING, CATEGORY, PRODUCT, promo({ id: "plat", scope: "PLATFORM", percentBps: 4000 })]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(80000);
    expect(result.lines[0].orgFundedPaise).toBe(60000);
    expect(result.lines[0].platformFundedPaise).toBe(20000);
  });

  it("competes a markdown against a percentage offer rather than compounding them", () => {
    // A markdown selling at ₹1,400 is ₹600 off; a 20% category offer is ₹400 off.
    const markdown = orgOffer("markdown", 0, [{ categoryId: null, productId: "earbuds" }]);
    const result = quote(
      [EARBUDS],
      [
        { ...markdown, valueType: "FIXED_PRICE", percentBps: null, fixedPricePaise: 140000 },
        CATEGORY,
      ]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(60000);
    expect(result.lines[0].winningPromotionId).toBe("markdown");
  });
});

describe("the window and the kill switch", () => {
  it("ignores an offer that has not started", () => {
    const result = quote([EARBUDS], [promo({ startsAt: new Date("2026-08-20T00:00:00Z") })]);
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("ignores an offer whose window has closed", () => {
    const result = quote([EARBUDS], [promo({ endsAt: new Date("2026-08-10T00:00:00Z") })]);
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("treats endsAt as exclusive, so the boundary has one reading", () => {
    const result = quote([EARBUDS], [promo({ endsAt: NOW })]);
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("honours the kill switch independently of the window", () => {
    const result = quote([EARBUDS], [promo({ isActive: false })]);
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("ignores an offer that has been fully claimed", () => {
    const result = quote([EARBUDS], [promo({ usageLimit: 100, usageCount: 100 })]);
    expect(result.totalDiscountPaise).toBe(0);
  });
});

describe("coupons", () => {
  const code = (o: Partial<EnginePromotion> = {}) =>
    promo({ id: "coupon", trigger: "CODE", code: "SUMMER20", label: "Summer 20", ...o });

  it("refuses a code that covers nothing in the basket, rather than applying zero", () => {
    const result = quote(
      [KURTA],
      [code({ targets: [{ categoryId: "electronics", productId: null }] })],
      "SUMMER20"
    );
    expect(result.rejection?.reason).toBe("NO_ELIGIBLE_ITEMS");
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("refuses an unknown code", () => {
    expect(quote([EARBUDS], [], "NOPE").rejection?.reason).toBe("NOT_FOUND");
  });

  it("refuses an expired code with its own reason, not a generic one", () => {
    const result = quote([EARBUDS], [code({ endsAt: new Date("2026-08-10T00:00:00Z") })], "SUMMER20");
    expect(result.rejection?.reason).toBe("NOT_LIVE");
  });

  it("refuses an exhausted code", () => {
    const result = quote([EARBUDS], [code({ usageLimit: 5, usageCount: 5 })], "SUMMER20");
    expect(result.rejection?.reason).toBe("EXHAUSTED");
  });

  it("reports the shortfall when the eligible goods fall short of the minimum", () => {
    const result = quote([EARBUDS], [code({ minSubtotalPaise: 250000 })], "SUMMER20");
    expect(result.rejection?.reason).toBe("MIN_SUBTOTAL_NOT_MET");
    expect(result.rejection?.shortfallPaise).toBe(50000);
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("measures the minimum on the eligible base, not the whole basket", () => {
    // ₹1,500 of apparel sits in the basket but outside the offer, so it cannot help
    // the earbuds reach a ₹2,500 minimum.
    const result = quote(
      [EARBUDS, KURTA],
      [code({ minSubtotalPaise: 250000, targets: [{ categoryId: "electronics", productId: null }] })],
      "SUMMER20"
    );
    expect(result.rejection?.reason).toBe("MIN_SUBTOTAL_NOT_MET");
  });

  it("changes no line when the running offer is already better, and says why", () => {
    const result = quote(
      [EARBUDS],
      [promo({ id: "auto25", percentBps: 2500 }), code({ percentBps: 1000 })],
      "SUMMER20"
    );
    expect(result.rejection?.reason).toBe("ALREADY_BETTER_OFF");
    expect(result.lines[0].buyerDiscountPaise).toBe(50000);
    expect(result.lines[0].winningPromotionId).toBe("auto25");
  });

  it("refuses a per-customer-limited code to a guest, rather than exempting them", () => {
    // A guest has no identity to count against. Applying it anyway makes the limit a
    // suggestion; skipping the check silently makes it a fiction. Neither is honest.
    const result = quote([EARBUDS], [code({ perUserLimit: 1 })], "SUMMER20", { userId: null });
    expect(result.rejection?.reason).toBe("SIGN_IN_REQUIRED");
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("allows a signed-in buyer who has not reached the limit", () => {
    const result = quote([EARBUDS], [code({ perUserLimit: 2 })], "SUMMER20", {
      userId: "u1",
      priorRedemptions: 1,
    });
    expect(result.rejection).toBeNull();
    expect(result.totalDiscountPaise).toBe(40000);
  });

  it("refuses a buyer who has reached the limit", () => {
    const result = quote([EARBUDS], [code({ perUserLimit: 2 })], "SUMMER20", {
      userId: "u1",
      priorRedemptions: 2,
    });
    expect(result.rejection?.reason).toBe("PER_USER_LIMIT_REACHED");
    expect(result.totalDiscountPaise).toBe(0);
  });

  it("says 'already used' when the limit is one, not 'the maximum 1 times'", () => {
    const result = quote([EARBUDS], [code({ perUserLimit: 1 })], "SUMMER20", {
      userId: "u1",
      priorRedemptions: 1,
    });
    expect(result.rejection?.message).toContain("already used");
  });

  it("ignores identity entirely when the offer sets no per-customer limit", () => {
    const result = quote([EARBUDS], [code()], "SUMMER20", { userId: null, priorRedemptions: 99 });
    expect(result.rejection).toBeNull();
  });

  it("respects its cap", () => {
    const result = quote([EARBUDS], [code({ percentBps: 2000, maxDiscountPaise: 10000 })], "SUMMER20");
    expect(result.lines[0].buyerDiscountPaise).toBe(10000);
  });

  it("is matched case-insensitively", () => {
    expect(quote([EARBUDS], [code()], "  summer20 ").rejection).toBeNull();
    expect(normaliseCode(" summer20 ")).toBe("SUMMER20");
  });

  it("covers part of a basket and leaves the rest on what it already had", () => {
    const result = quote(
      [EARBUDS, KURTA],
      [
        promo({ id: "orgAuto", scope: "ORG", orgId: "abc", percentBps: 1500, targets: [{ categoryId: "electronics", productId: null }] }),
        code({ targets: [{ categoryId: "electronics", productId: null }] }),
      ],
      "SUMMER20"
    );
    expect(result.couponCoveredKeys).toEqual([EARBUDS.key]);
    expect(result.lines[1].buyerDiscountPaise).toBe(0);
  });
});

describe("the worked example from the architecture note", () => {
  // ABC Traders: 15% off its own Electronics, platform running SUMMER20 at 20%.
  const PROMOS = [
    promo({
      id: "abc15",
      label: "15% off ABC Electronics",
      scope: "ORG",
      orgId: "abc",
      percentBps: 1500,
      targets: [{ categoryId: "electronics", productId: null }],
    }),
    promo({ id: "summer20", label: "Summer 20", scope: "PLATFORM", trigger: "CODE", code: "SUMMER20", percentBps: 2000 }),
  ];

  it("reproduces the published figures exactly", () => {
    const result = quote([EARBUDS, KURTA], PROMOS, "SUMMER20");
    const [earbuds, kurta] = result.lines;

    expect(earbuds.buyerDiscountPaise).toBe(40000); // ₹400
    expect(earbuds.orgFundedPaise).toBe(30000); //     ₹300
    expect(earbuds.platformFundedPaise).toBe(10000); // ₹100

    expect(kurta.buyerDiscountPaise).toBe(30000); //   ₹300
    expect(kurta.orgFundedPaise).toBe(0);
    expect(kurta.platformFundedPaise).toBe(30000);

    expect(result.totalDiscountPaise).toBe(70000); // ₹700 off ₹3,500 → ₹2,800
    const org = result.lines.reduce((s, l) => s + l.orgFundedPaise, 0);
    const plat = result.lines.reduce((s, l) => s + l.platformFundedPaise, 0);
    expect(org).toBe(30000); //  ₹300 funded by ABC
    expect(plat).toBe(40000); // ₹400 funded by the platform
    expectInternallyConsistent(result, [EARBUDS, KURTA]);
  });

  it("attributes the platform's cost to the offer that caused it", () => {
    const result = quote([EARBUDS, KURTA], PROMOS, "SUMMER20");
    const summer = result.attributions.find((a) => a.promotionId === "summer20");
    expect(summer?.platformFundedPaise).toBe(40000);
    expect(summer?.orgFundedPaise).toBe(30000);
    expect(summer?.codeSnapshot).toBe("SUMMER20");
  });
});

describe("automaticUnitPrice — what a product page shows (ADR-0018)", () => {
  it("returns the reduced price and the offer that set it", () => {
    const result = automaticUnitPrice(EARBUDS, [promo({ id: "auto", label: "20% off", percentBps: 2000 })], PARENTS, NOW);
    expect(result.effectivePaise).toBe(160000);
    expect(result.discountPerUnitPaise).toBe(40000);
    expect(result.promotionId).toBe("auto");
    expect(result.label).toBe("20% off");
  });

  it("ignores coupons, which need a code the page does not have", () => {
    const result = automaticUnitPrice(
      EARBUDS,
      [promo({ trigger: "CODE", code: "SUMMER20" })],
      PARENTS,
      NOW
    );
    expect(result.effectivePaise).toBe(200000);
    expect(result.promotionId).toBeNull();
  });

  it("expresses a markdown as a fixed selling price", () => {
    const result = automaticUnitPrice(
      EARBUDS,
      [promo({ valueType: "FIXED_PRICE", percentBps: null, fixedPricePaise: 96000 })],
      PARENTS,
      NOW
    );
    expect(result.effectivePaise).toBe(96000);
    expect(result.discountPerUnitPaise).toBe(104000);
  });

  it("agrees with the engine, so display and charge cannot diverge", () => {
    const offers = [promo({ id: "auto", scope: "ORG", orgId: "abc", percentBps: 1500 })];
    const shown = automaticUnitPrice(EARBUDS, offers, PARENTS, NOW);
    const charged = quote([{ ...EARBUDS, quantity: 3 }], offers);
    expect(charged.lines[0].buyerDiscountPaise).toBe(shown.discountPerUnitPaise * 3);
  });
});

describe("a flat amount means two different things (promotions D5)", () => {
  const flat = (o: Partial<EnginePromotion> = {}) =>
    promo({ valueType: "AMOUNT_OFF", percentBps: null, amountOffPaise: 10000, ...o });

  const THREE = [
    line({ key: "a", productId: "a" }),
    line({ key: "b", productId: "b" }),
    line({ key: "c", productId: "c" }),
  ];

  it("a coupon takes it off the order once, spread across covered lines", () => {
    const result = quote(THREE, [flat({ trigger: "CODE", code: "FLAT100" })], "FLAT100");
    expect(result.totalDiscountPaise).toBe(10000);
    // Largest remainder, so the shares sum to exactly ₹100 rather than ₹99.99.
    expect(result.lines.map((l) => l.buyerDiscountPaise)).toEqual([3334, 3333, 3333]);
  });

  it("an automatic offer takes it off every unit", () => {
    // Forced, not chosen: this figure is the price shown on a product page, and a
    // product page has no basket to take an order-level amount off.
    const result = quote(THREE, [flat()]);
    expect(result.totalDiscountPaise).toBe(30000);
    expect(result.lines.every((l) => l.buyerDiscountPaise === 10000)).toBe(true);
  });

  it("multiplies by quantity when automatic, and does not when a coupon", () => {
    const three = [line({ quantity: 3 })];
    expect(quote(three, [flat()]).totalDiscountPaise).toBe(30000);
    expect(
      quote(three, [flat({ trigger: "CODE", code: "FLAT100" })], "FLAT100").totalDiscountPaise
    ).toBe(10000);
  });

  it("never takes more off a line than the line is worth", () => {
    const cheap = [line({ unitPrice: 4000 })];
    expect(quote(cheap, [flat()]).totalDiscountPaise).toBe(4000);
    expect(
      quote(cheap, [flat({ trigger: "CODE", code: "FLAT100" })], "FLAT100").totalDiscountPaise
    ).toBe(4000);
  });
});

describe("quantities and rounding", () => {
  it("rounds once per unit so displayed price times quantity equals the line", () => {
    const odd = line({ unitPrice: 999, quantity: 3 });
    const result = quote([odd], [promo({ percentBps: 2000 })]);
    // 20% of 999 floors to 199 per unit; the line is 3 × 199, not floor(20% of 2997).
    expect(result.lines[0].buyerDiscountPaise).toBe(597);
  });

  it("never discounts a line below zero", () => {
    const result = quote(
      [line({ unitPrice: 100 })],
      [promo({ valueType: "AMOUNT_OFF", percentBps: null, amountOffPaise: 500000 })]
    );
    expect(result.lines[0].buyerDiscountPaise).toBe(100);
  });

  it("keeps the split reconciling across a spread of awkward prices", () => {
    for (const unitPrice of [1, 7, 99, 333, 1001, 99999]) {
      for (const quantity of [1, 2, 7]) {
        const l = line({ unitPrice, quantity });
        const result = quote(
          [l],
          [
            promo({ id: "o", scope: "ORG", orgId: "abc", percentBps: 1333 }),
            promo({ id: "p", scope: "PLATFORM", percentBps: 1777 }),
          ]
        );
        expectInternallyConsistent(result, [l]);
      }
    }
  });
});
