// A platform offer that can cost more than commission needs a confirmation and a budget
// (offers-hardening R4, D6, Q2). The rule is pure and shared by the form and the server, so
// these pin it once for both; the schema tests pin the mistakes refused before it runs.
import { describe, expect, it } from "vitest";
import { couldCostMoreThanCommission, lossWarning, type LossTestOffer } from "@server/promotions/loss";
import { platformPromotionSchema, promotionFormSchema } from "@/lib/validation/schemas/promotion.schema";

const LOWEST = 1500; // 15%
const offer = (over: Partial<LossTestOffer>): LossTestOffer => ({
  valueType: "PERCENT", percentBps: null, amountOffPaise: null, fixedPricePaise: null, minSubtotalPaise: 0, ...over,
});

describe("could a platform offer cost more than commission (spec A5)", () => {
  it("a percentage above the lowest rate can lose (spec A5)", () => {
    expect(couldCostMoreThanCommission(offer({ percentBps: 3000 }), LOWEST)).toBe(true);
  });

  it("a percentage equal to the lowest rate is not a loss (spec A5)", () => {
    expect(couldCostMoreThanCommission(offer({ percentBps: 1500 }), LOWEST)).toBe(false);
    expect(couldCostMoreThanCommission(offer({ percentBps: 1501 }), LOWEST)).toBe(true);
  });

  it("no value typed yet shows no panel (spec A5)", () => {
    expect(couldCostMoreThanCommission(offer({}), LOWEST)).toBe(false);
    expect(couldCostMoreThanCommission(offer({ valueType: "AMOUNT_OFF" }), LOWEST)).toBe(false);
    expect(couldCostMoreThanCommission(offer({ valueType: "FIXED_PRICE" }), LOWEST)).toBe(false);
  });

  it("a flat amount with no minimum spend can always lose (spec A5)", () => {
    expect(couldCostMoreThanCommission(offer({ valueType: "AMOUNT_OFF", amountOffPaise: 100 }), LOWEST)).toBe(true);
  });

  it("a flat amount is measured against the rate on its minimum spend; equal is not a loss (spec A5)", () => {
    // 15% of ₹1,000 is ₹150.
    const flat = (amountOffPaise: number) =>
      couldCostMoreThanCommission(offer({ valueType: "AMOUNT_OFF", amountOffPaise, minSubtotalPaise: 100_000 }), LOWEST);
    expect(flat(15_000)).toBe(false);
    expect(flat(15_001)).toBe(true);
  });

  it("a platform fixed selling price is treated as able to lose (spec A5)", () => {
    expect(couldCostMoreThanCommission(offer({ valueType: "FIXED_PRICE", fixedPricePaise: 50_000 }), LOWEST)).toBe(true);
  });

  it("the panel's words name the lowest rate (spec A5)", () => {
    expect(lossWarning(1500)).toBe(
      "This can cost more than we earn on a sale (lowest commission 15%). Type CONFIRM LOSS and set a budget to run it anyway.",
    );
  });
});

describe("the platform form's schema (spec A5)", () => {
  const base = {
    label: "Diwali", trigger: "AUTOMATIC", valueType: "PERCENT", percent: 30,
    startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-10T00:00:00Z", isActive: true,
    categoryIds: [], productIds: [],
  };
  const issue = (input: Record<string, unknown>, path: string) => {
    const result = platformPromotionSchema.safeParse({ ...base, ...input });
    return result.success ? undefined : result.error.issues.find((i) => i.path.join(".") === path)?.message;
  };

  it("accepts the phrase exactly and a positive budget (spec A5)", () => {
    const result = platformPromotionSchema.safeParse({ ...base, confirmLoss: "CONFIRM LOSS", budget: 1000 });
    expect(result.success && result.data).toMatchObject({ confirmLoss: "CONFIRM LOSS", budget: 1000 });
  });

  it("refuses a phrase that is not exactly CONFIRM LOSS (spec A5)", () => {
    expect(issue({ confirmLoss: "confirm loss" }, "confirmLoss")).toBe("Type CONFIRM LOSS exactly.");
    expect(issue({ confirmLoss: "CONFIRM" }, "confirmLoss")).toBe("Type CONFIRM LOSS exactly.");
  });

  it("an empty phrase is absent, not a mistake (spec A5)", () => {
    expect(platformPromotionSchema.safeParse({ ...base, confirmLoss: "" }).success).toBe(true);
  });

  it("refuses a zero, negative or sub-paise budget (spec A5)", () => {
    expect(issue({ budget: 0 }, "budget")).toBeDefined();
    expect(issue({ budget: -5 }, "budget")).toBeDefined();
    expect(issue({ budget: 10.005 }, "budget")).toBeDefined();
  });

  it("never carries the spend or who confirmed, whatever the body says (Invariant 4)", () => {
    const result = platformPromotionSchema.safeParse({
      ...base, platformSpentPaise: 0, lossConfirmedByUserId: "someone", lossConfirmedAt: new Date(),
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty("platformSpentPaise");
    expect(result.success && result.data).not.toHaveProperty("lossConfirmedByUserId");
    expect(result.success && result.data).not.toHaveProperty("lossConfirmedAt");
  });

  it("a shop's form carries no budget or confirmation at all (spec A5)", () => {
    const result = promotionFormSchema.safeParse({ ...base, percent: 10, budget: 1000, confirmLoss: "CONFIRM LOSS" });
    expect(result.success && result.data).not.toHaveProperty("budget");
    expect(result.success && result.data).not.toHaveProperty("confirmLoss");
  });
});
