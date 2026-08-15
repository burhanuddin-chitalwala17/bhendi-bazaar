// What an organisation is owed and what the platform keeps (org-payouts D2/D4).
//
// The load-bearing assertion here is the commission *base*: gross less the
// organisation's own funded discount, and never what the buyer paid. Getting that
// wrong does not fail loudly — it just quietly moves money from the organisation to
// the platform on every discounted order.
import { describe, expect, it } from "vitest";
import {
  buyerPaidPaise,
  computeLedgerEntry,
  platformNetPaise,
  projectForOrg,
  resolveRateBps,
  type LedgerLineInput,
} from "@server/payouts/commission";

// Electronics → Audio → Headphones, and a separate Apparel tree.
const PARENTS = new Map<string, string | null>([
  ["electronics", null],
  ["audio", "electronics"],
  ["headphones", "audio"],
  ["apparel", null],
]);

const compute = (
  lines: LedgerLineInput[],
  platformFundedPaise = 0,
  rules: Map<string, number> = new Map([["electronics", 1200]]),
  orgDefaultBps = 1500
) => computeLedgerEntry({ lines, platformFundedPaise, parents: PARENTS, rules, orgDefaultBps });

describe("resolveRateBps — nearest ancestor wins (D4b)", () => {
  const rules = new Map([["electronics", 1200]]);

  it("takes an ancestor's rate when the item's own category has none", () => {
    expect(resolveRateBps("headphones", PARENTS, rules, 1500)).toBe(1200);
  });

  it("prefers the nearest rule over a more distant one", () => {
    const nested = new Map([["electronics", 1200], ["audio", 900]]);
    expect(resolveRateBps("headphones", PARENTS, nested, 1500)).toBe(900);
  });

  it("takes the category's own rule ahead of any ancestor", () => {
    const nested = new Map([["electronics", 1200], ["headphones", 800]]);
    expect(resolveRateBps("headphones", PARENTS, nested, 1500)).toBe(800);
  });

  it("falls back to the organisation's default when no ancestor carries a rule", () => {
    expect(resolveRateBps("apparel", PARENTS, rules, 1500)).toBe(1500);
  });

  it("uses the default when the organisation has no rules at all", () => {
    expect(resolveRateBps("headphones", PARENTS, new Map(), 1500)).toBe(1500);
  });

  it("terminates on a cycle rather than looping on a listing render", () => {
    const cyclic = new Map<string, string | null>([["a", "b"], ["b", "a"]]);
    expect(resolveRateBps("a", cyclic, new Map(), 1500)).toBe(1500);
  });
});

describe("the commission base excludes the platform's funding (D2)", () => {
  // The worked figures from the ADR: ₹1,000 of goods, ₹150 org-funded, ₹50 platform.
  const LINES: LedgerLineInput[] = [
    { orderItemId: "i1", categoryId: "apparel", grossPaise: 100000, orgFundedPaise: 15000 },
  ];

  it("bases commission on gross less the org's own discount, not on what the buyer paid", () => {
    const entry = compute(LINES, 5000);
    expect(entry.commissionBasePaise).toBe(85000); // ₹850, not the ₹800 paid
    expect(entry.commissionPaise).toBe(12750); //     15% of ₹850
    expect(entry.payablePaise).toBe(72250); //        ₹722.50
    expect(platformNetPaise(entry)).toBe(7750); //    ₹77.50 = ₹127.50 − ₹50
  });

  it("satisfies the database's own check: base = gross − orgFunded", () => {
    const entry = compute(LINES, 5000);
    expect(entry.commissionBasePaise).toBe(
      entry.grossItemsPaise - entry.orgFundedDiscountPaise
    );
  });

  it("reconciles: payable + commission − platform funding = what the buyer paid", () => {
    const entry = compute(LINES, 5000);
    expect(entry.payablePaise + platformNetPaise(entry)).toBe(buyerPaidPaise(entry));
  });
});

describe("the asymmetric floor (D2a)", () => {
  it("earns the full rate on the reduced base when the org outbids the platform", () => {
    // Org funds the whole ₹200 of a ₹1,000 line; the platform contributes nothing.
    const entry = compute(
      [{ orderItemId: "i1", categoryId: "apparel", grossPaise: 100000, orgFundedPaise: 20000 }],
      0
    );
    expect(entry.commissionBasePaise).toBe(80000);
    expect(entry.commissionPaise).toBe(12000); // full 15% of ₹800
    expect(platformNetPaise(entry)).toBe(12000); // nothing funded, nothing given up
    expect(entry.isNegativeMargin).toBe(false);
  });

  it("flags an entry where the platform funded more than it earned (D12)", () => {
    const entry = compute(
      [{ orderItemId: "i1", categoryId: "apparel", grossPaise: 100000, orgFundedPaise: 0 }],
      20000 // platform funded ₹200 against a ₹150 commission
    );
    expect(entry.commissionPaise).toBe(15000);
    expect(platformNetPaise(entry)).toBe(-5000);
    expect(entry.isNegativeMargin).toBe(true);
  });
});

describe("per-line rates in one entry (D4c)", () => {
  // The published example: earbuds at 12% (Electronics), kurta at 15% (default).
  const LINES: LedgerLineInput[] = [
    { orderItemId: "earbuds", categoryId: "headphones", grossPaise: 200000, orgFundedPaise: 30000 },
    { orderItemId: "kurta", categoryId: "apparel", grossPaise: 150000, orgFundedPaise: 0 },
  ];

  it("reproduces the published figures exactly", () => {
    const entry = compute(LINES, 40000);

    expect(entry.lines[0]).toMatchObject({ basePaise: 170000, rateBps: 1200, commissionPaise: 20400 });
    expect(entry.lines[1]).toMatchObject({ basePaise: 150000, rateBps: 1500, commissionPaise: 22500 });

    expect(entry.grossItemsPaise).toBe(350000); //     ₹3,500
    expect(entry.commissionBasePaise).toBe(320000); // ₹3,200
    expect(entry.commissionPaise).toBe(42900); //      ₹429
    expect(entry.payablePaise).toBe(277100); //        ₹2,771
    expect(buyerPaidPaise(entry)).toBe(280000); //     ₹2,800
    expect(platformNetPaise(entry)).toBe(2900); //     ₹29
  });

  it("sums commission from the lines rather than taking a rate on the total", () => {
    const entry = compute(LINES, 40000);
    const summed = entry.lines.reduce((s, l) => s + l.commissionPaise, 0);
    expect(entry.commissionPaise).toBe(summed);
    // A single blended rate on ₹3,200 could not produce ₹429.
    expect(entry.commissionPaise).not.toBe(Math.floor((320000 * 1500) / 10000));
  });

  it("goes negative for the platform at a deeper campaign, leaving the org untouched", () => {
    // SUMMER20 at 25% instead of 20%: the org's side does not move at all.
    const entry = compute(LINES, 57500);
    expect(entry.commissionPaise).toBe(42900);
    expect(entry.payablePaise).toBe(277100);
    expect(platformNetPaise(entry)).toBe(-14600); // −₹146
    expect(entry.isNegativeMargin).toBe(true);
  });
});

describe("rounding", () => {
  it("leaves no stray paise between payable, commission and base", () => {
    for (const gross of [1, 7, 999, 100001, 333333]) {
      for (const rate of [1, 733, 1500, 9999]) {
        const entry = compute(
          [{ orderItemId: "i", categoryId: "apparel", grossPaise: gross, orgFundedPaise: 0 }],
          0,
          new Map(),
          rate
        );
        expect(entry.payablePaise + entry.commissionPaise).toBe(entry.commissionBasePaise);
        expect(entry.commissionPaise).toBeLessThanOrEqual(entry.commissionBasePaise);
        expect(entry.payablePaise).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("the organisation's projection (D13)", () => {
  const written = {
    grossItemsPaise: 350000,
    orgFundedDiscountPaise: 30000,
    platformFundedDiscountPaise: 40000,
    commissionPaise: 42900,
    payablePaise: 277100,
    lines: [
      { orderItemId: "earbuds", basePaise: 170000, rateBps: 1200, commissionPaise: 20400 },
      { orderItemId: "kurta", basePaise: 150000, rateBps: 1500, commissionPaise: 22500 },
    ],
  };

  it("shows the org the same payable the platform sees, to the paise", () => {
    expect(projectForOrg(written).payablePaise).toBe(written.payablePaise);
  });

  it("discloses the platform's contribution rather than leaving an unexplained gap", () => {
    const view = projectForOrg(written);
    expect(view.platformContributionPaise).toBe(40000);
    // Without it, being credited on ₹3,200 for goods buyers paid ₹2,800 for reads as an error.
    expect(view.buyerPaidPaise).toBe(280000);
    expect(view.grossItemsPaise - view.orgFundedDiscountPaise - view.buyerPaidPaise).toBe(40000);
  });

  it("omits the contribution entirely when there was none", () => {
    const view = projectForOrg({ ...written, platformFundedDiscountPaise: 0 });
    expect(view.platformContributionPaise).toBeNull();
  });

  it("shows which rate applied to what, rather than one averaged figure (R18)", () => {
    expect(projectForOrg(written).rates.map((r) => r.rateBps)).toEqual([1200, 1500]);
  });

  it("reads the stored figures rather than recomputing them", () => {
    // A hand-corrected entry must project as corrected, not as re-derived.
    const corrected = { ...written, payablePaise: 999999 };
    expect(projectForOrg(corrected).payablePaise).toBe(999999);
  });
});
