/**
 * offerCoverage is the pure heart of the "on offer" listing filter: given the
 * request's already-loaded promotions and category-parents map, which products
 * does a live automatic offer reach? It replaced a repository method that
 * re-queried both tables per listing (billed-operations work, 2026-08-21), so
 * these tests are also the contract that it stays pure — no clock, no database.
 */
import { describe, it, expect } from "vitest";
import { offerCoverage, type CategoryParents } from "@server/promotions/targeting";
import type { EnginePromotion, PromotionTargetRow } from "@server/promotions/promotion.types";

const base: Omit<EnginePromotion, "scope" | "orgId" | "trigger" | "targets"> = {
  id: "promo-1",
  label: "Test offer",
  code: null,
  valueType: "PERCENT",
  percentBps: 1000,
  amountOffPaise: null,
  fixedPricePaise: null,
  maxDiscountPaise: null,
  minSubtotalPaise: 0,
  startsAt: new Date("2026-01-01"),
  endsAt: new Date("2027-01-01"),
  isActive: true,
  usageLimit: null,
  usageCount: 0,
  perUserLimit: null,
};

function promo(overrides: Partial<EnginePromotion>): EnginePromotion {
  return {
    ...base,
    scope: "PLATFORM",
    orgId: null,
    trigger: "AUTOMATIC",
    targets: [],
    ...overrides,
  } as EnginePromotion;
}

function target(row: Partial<PromotionTargetRow>): PromotionTargetRow {
  return { productId: null, categoryId: null, ...row } as PromotionTargetRow;
}

//   root ── mid ── leaf     (parent pointers, null = root)
const parents: CategoryParents = new Map([
  ["root", null],
  ["mid", "root"],
  ["leaf", "mid"],
  ["other", null],
]);

describe("offerCoverage", () => {
  it("an untargeted platform offer covers everything", () => {
    const coverage = offerCoverage([promo({})], parents);
    expect(coverage.coversEverything).toBe(true);
  });

  it("an untargeted org offer covers the org, not everything", () => {
    const coverage = offerCoverage(
      [promo({ scope: "ORG", orgId: "org-1" })],
      parents
    );
    expect(coverage.coversEverything).toBe(false);
    expect(coverage.orgIds).toEqual(["org-1"]);
    expect(coverage.productIds).toEqual([]);
    expect(coverage.categoryIds).toEqual([]);
  });

  it("a product target names exactly that product", () => {
    const coverage = offerCoverage(
      [promo({ targets: [target({ productId: "prod-1" })] })],
      parents
    );
    expect(coverage.productIds).toEqual(["prod-1"]);
    expect(coverage.coversEverything).toBe(false);
  });

  it("a category target reaches its whole subtree", () => {
    const coverage = offerCoverage(
      [promo({ targets: [target({ categoryId: "root" })] })],
      parents
    );
    expect([...coverage.categoryIds].sort()).toEqual(["leaf", "mid", "root"]);
    expect(coverage.categoryIds).not.toContain("other");
  });

  it("a mid-tree target reaches down, never up", () => {
    const coverage = offerCoverage(
      [promo({ targets: [target({ categoryId: "mid" })] })],
      parents
    );
    expect([...coverage.categoryIds].sort()).toEqual(["leaf", "mid"]);
  });

  it("CODE offers never surface as automatic coverage", () => {
    const coverage = offerCoverage(
      [promo({ trigger: "CODE", code: "SAVE10" })],
      parents
    );
    expect(coverage.coversEverything).toBe(false);
    expect(coverage.productIds).toEqual([]);
    expect(coverage.orgIds).toEqual([]);
    expect(coverage.categoryIds).toEqual([]);
  });

  it("no live offers means empty coverage, never everything", () => {
    const coverage = offerCoverage([], parents);
    expect(coverage.coversEverything).toBe(false);
    expect(coverage.productIds).toEqual([]);
  });

  it("mixed targets accumulate across promotions", () => {
    const coverage = offerCoverage(
      [
        promo({ id: "p1", targets: [target({ productId: "prod-1" })] }),
        promo({ id: "p2", targets: [target({ categoryId: "other" })] }),
        promo({ id: "p3", scope: "ORG", orgId: "org-9" }),
      ],
      parents
    );
    expect(coverage.productIds).toEqual(["prod-1"]);
    expect(coverage.categoryIds).toEqual(["other"]);
    expect(coverage.orgIds).toEqual(["org-9"]);
  });
});
