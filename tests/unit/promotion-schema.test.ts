// What an offer form may say (Invariant 4, ADR-0013).
//
// One schema validates on both sides, so these tests pin what a buyer-facing form
// shows inline *and* what the handler enforces. The rules worth pinning hardest are
// the ones that are not obvious from the field names: an automatic offer cannot carry
// a basket condition, because the product page that displays its price has no basket
// to test it against.
import { describe, expect, it } from "vitest";
import { promotionFormSchema } from "@/lib/validation/schemas/promotion.schema";

const base = {
  label: "Summer Sale",
  trigger: "AUTOMATIC" as const,
  valueType: "PERCENT" as const,
  percent: 20,
  startsAt: "2026-08-01T00:00:00Z",
  endsAt: "2026-09-01T00:00:00Z",
  isActive: true,
  categoryIds: [],
  productIds: [],
};

const parse = (overrides: Record<string, unknown> = {}) =>
  promotionFormSchema.safeParse({ ...base, ...overrides });

const errorOn = (result: ReturnType<typeof parse>, path: string) =>
  !result.success && result.error.issues.some((issue) => issue.path.join(".") === path);

describe("the window", () => {
  it("accepts an offer that ends after it starts", () => {
    expect(parse().success).toBe(true);
  });

  it("refuses a window that ends before it starts", () => {
    const result = parse({ endsAt: "2026-07-01T00:00:00Z" });
    expect(errorOn(result, "endsAt")).toBe(true);
  });

  it("requires both dates — no offer runs indefinitely (spec R4)", () => {
    expect(promotionFormSchema.safeParse({ ...base, endsAt: undefined }).success).toBe(false);
    expect(promotionFormSchema.safeParse({ ...base, startsAt: undefined }).success).toBe(false);
  });
});

describe("trigger and code agree", () => {
  it("requires a code when the offer is unlocked by one", () => {
    expect(errorOn(parse({ trigger: "CODE" }), "code")).toBe(true);
  });

  it("accepts a coupon with a code", () => {
    expect(parse({ trigger: "CODE", code: "SUMMER20" }).success).toBe(true);
  });

  it("refuses a code on an offer that applies by itself", () => {
    expect(errorOn(parse({ code: "SUMMER20" }), "code")).toBe(true);
  });

  it("normalises what the buyer types", () => {
    const result = parse({ trigger: "CODE", code: "  summer20 " });
    expect(result.success && result.data.code).toBe("SUMMER20");
  });

  it("refuses a code with characters that will not survive being read aloud", () => {
    expect(parse({ trigger: "CODE", code: "SUM MER" }).success).toBe(false);
    expect(parse({ trigger: "CODE", code: "SUMMER!" }).success).toBe(false);
  });
});

describe("basket conditions belong to coupons (promotions D5)", () => {
  it("refuses a minimum spend on an automatic offer", () => {
    // A product page sets the displayed price and cannot know the basket, so an
    // automatic offer that depended on one could not be honoured where it is shown.
    expect(errorOn(parse({ minSubtotal: 500 }), "minSubtotal")).toBe(true);
  });

  it("refuses a discount cap on an automatic offer", () => {
    expect(errorOn(parse({ maxDiscount: 200 }), "minSubtotal")).toBe(true);
  });

  it("allows both on a percentage coupon", () => {
    expect(parse({ trigger: "CODE", code: "SAVE", minSubtotal: 500, maxDiscount: 200 }).success).toBe(true);
  });
});

describe("a cap only means something for a percentage", () => {
  const flatCoupon = {
    trigger: "CODE" as const,
    code: "FLAT100",
    valueType: "AMOUNT_OFF" as const,
    percent: undefined,
    amountOff: 100,
  };

  it("refuses a cap on a fixed amount — it is already its own limit", () => {
    // A cap above the amount does nothing; one below it silently makes the offer
    // something other than what its own field says.
    expect(errorOn(parse({ ...flatCoupon, maxDiscount: 200 }), "maxDiscount")).toBe(true);
  });

  it("accepts a fixed amount with no cap", () => {
    expect(parse(flatCoupon).success).toBe(true);
  });

  it("still allows a minimum spend on a fixed amount", () => {
    // "₹100 off orders over ₹500" is a real offer; the minimum is not the cap.
    expect(parse({ ...flatCoupon, minSubtotal: 500 }).success).toBe(true);
  });
});

describe("a value matches its type", () => {
  it("requires a percentage for a percentage offer", () => {
    expect(errorOn(parse({ percent: undefined }), "percent")).toBe(true);
  });

  it("requires an amount for an amount-off offer", () => {
    expect(errorOn(parse({ valueType: "AMOUNT_OFF", percent: undefined }), "amountOff")).toBe(true);
  });

  it("refuses a discount of nothing, or of more than the price", () => {
    expect(parse({ percent: 0 }).success).toBe(false);
    expect(parse({ percent: 101 }).success).toBe(false);
  });
});

describe("a fixed selling price is a markdown", () => {
  const markdown = { valueType: "FIXED_PRICE" as const, percent: undefined, fixedPrice: 960 };

  it("has to name the products it prices", () => {
    // Applied to a basket a fixed price has no meaning; it prices one thing.
    expect(errorOn(parse(markdown), "productIds")).toBe(true);
  });

  it("is accepted when it names them", () => {
    expect(parse({ ...markdown, productIds: ["p1"] }).success).toBe(true);
  });

  it("cannot be a coupon", () => {
    const result = parse({ ...markdown, productIds: ["p1"], trigger: "CODE", code: "X" });
    expect(errorOn(result, "valueType")).toBe(true);
  });
});

describe("server-owned fields never arrive through the body", () => {
  it("strips a client-sent usage count", () => {
    const result = parse({ usageCount: 999 });
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty("usageCount");
  });

  it("strips a client-sent scope and org", () => {
    // Which party funds an offer is decided by which route the request came through,
    // never by the payload — a body-supplied orgId is how one organisation would
    // scope an offer to another's goods.
    const result = parse({ scope: "PLATFORM", orgId: "someone-else" });
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty("scope");
    expect(result.success && result.data).not.toHaveProperty("orgId");
  });

  it("strips a client-sent id", () => {
    const result = parse({ id: "forged" });
    expect(result.success && result.data).not.toHaveProperty("id");
  });
});

describe("targeting", () => {
  it("accepts an offer with no targets — everything in scope (spec R2/D3)", () => {
    expect(parse({ categoryIds: [], productIds: [] }).success).toBe(true);
  });

  it("accepts category and product targets together", () => {
    expect(parse({ categoryIds: ["c1"], productIds: ["p1"] }).success).toBe(true);
  });
});
