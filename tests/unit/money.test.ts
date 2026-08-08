// Money is integer paise everywhere between two edges: rupeesToPaise where a human
// typed rupees, formatCurrency where a human reads them (Invariant 3, ADR-0004).
// The float cases below are the reason the rule exists — each was representable
// wrongly under Float columns.
import { describe, expect, it } from "vitest";
import { rupeesToPaise, paiseToRupees } from "@server/shared/money";
import { formatCurrency } from "@/lib/format";
import { rupeeAmount } from "@/lib/validation/schemas/common.schemas";

describe("rupeesToPaise", () => {
  it("converts whole rupees exactly", () => {
    expect(rupeesToPaise(1200)).toBe(120000);
  });

  it("survives IEEE754 dust — 0.29 * 100 is 28.999999999999996 in float land", () => {
    expect(0.29 * 100).not.toBe(29); // the defect
    expect(rupeesToPaise(0.29)).toBe(29); // the fix
  });

  it("round-trips through paiseToRupees", () => {
    for (const r of [0, 1, 99.99, 1200.5, 10000000]) {
      expect(paiseToRupees(rupeesToPaise(r))).toBe(r);
    }
  });
});

describe("integer totals do not drift", () => {
  it("sums a basket exactly where float rupees drifted", () => {
    // 0.1 + 0.2 !== 0.3 is the canonical case; as paise it is 10 + 20 === 30.
    const floatTotal = 0.1 + 0.2;
    expect(floatTotal).not.toBe(0.3);
    expect(rupeesToPaise(0.1) + rupeesToPaise(0.2)).toBe(30);
  });

  it("compares totals with === and no tolerance", () => {
    const items = Array.from({ length: 37 }, () => 129900); // ₹1,299 × 37
    const total = items.reduce((s, p) => s + p, 0);
    expect(total === 37 * 129900).toBe(true);
  });
});

describe("formatCurrency reads paise", () => {
  it("formats whole rupees without decimals", () => {
    expect(formatCurrency(120000)).toBe("₹1,200");
  });

  it("shows paise when they exist", () => {
    expect(formatCurrency(120050)).toBe("₹1,200.50");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("₹0");
  });

  it("formats large amounts in the Indian grouping", () => {
    expect(formatCurrency(1234567800)).toBe("₹1,23,45,678");
  });
});

describe("rupeeAmount accepts what humans type and nothing finer", () => {
  const schema = rupeeAmount("Price");

  it("accepts two decimal places", () => {
    expect(schema.safeParse(1200.5).success).toBe(true);
    expect(schema.safeParse(1200.55).success).toBe(true);
  });

  it("rejects sub-paisa amounts", () => {
    const r = schema.safeParse(1200.505);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Price can have at most two decimal places");
  });

  it("rejects zero and negatives", () => {
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse(-5).success).toBe(false);
  });
});
