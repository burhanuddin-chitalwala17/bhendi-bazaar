/**
 * The bulk action body is parsed, never trusted (Invariant 4): a server-owned field is refused by
 * name rather than dropped, money arrives as integer paise, and a selection is capped.
 */
import { describe, expect, it } from "vitest";
import { bulkProductActionSchema, teamBulkProductActionSchema } from "@/lib/validation/schemas/product-bulk.schema";
import { MAX_BULK_PRODUCTS } from "@server/catalog/product-bulk.types";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const price = { action: "price", productIds: ["p1"], change: { mode: "set", pricePaise: 1_000 } };

describe("bulk product action schema", () => {
  it("accepts each action in its own shape", () => {
    expect(bulkProductActionSchema.safeParse(price).success).toBe(true);
    expect(bulkProductActionSchema.safeParse({ action: "archive", productIds: ["p1"] }).success).toBe(true);
    expect(bulkProductActionSchema.safeParse({ action: "send", productIds: ["p1"], channel: "amazon" }).success).toBe(true);
    expect(
      bulkProductActionSchema.safeParse({ action: "stock", rows: [{ productId: "p1", orgAddressId: "a1", quantity: 3, seenQuantity: 0 }] }).success,
    ).toBe(true);
  });

  it.each([
    ["orgId", { ...price, orgId: "another-shop" }],
    ["archivedAt", { action: "archive", productIds: ["p1"], archivedAt: "2026-01-01" }],
    ["version", { ...price, version: 3 }],
    ["a computed price per product", { ...price, change: { mode: "percent", percent: 10, pricePaise: 1 } }],
    ["slug on a stock row", { action: "stock", rows: [{ productId: "p1", orgAddressId: "a1", quantity: 1, seenQuantity: 0, slug: "x" }] }],
  ])("refuses a server-owned field: %s", (_, body) => {
    expect(bulkProductActionSchema.safeParse(body).success).toBe(false);
  });

  it("takes money only as integer paise, and a percentage to two decimals", () => {
    expect(bulkProductActionSchema.safeParse({ ...price, change: { mode: "set", pricePaise: 10.5 } }).success).toBe(false);
    expect(bulkProductActionSchema.safeParse({ ...price, change: { mode: "set", pricePaise: 0 } }).success).toBe(false);
    expect(bulkProductActionSchema.safeParse({ ...price, change: { mode: "percent", percent: 12.345 } }).success).toBe(false);
    expect(bulkProductActionSchema.safeParse({ ...price, change: { mode: "percent", percent: -100 } }).success).toBe(false);
    expect(bulkProductActionSchema.safeParse({ ...price, change: { mode: "amount", deltaPaise: 0 } }).success).toBe(false);
  });

  it(`caps a selection at ${MAX_BULK_PRODUCTS}, and refuses a product named twice`, () => {
    expect(bulkProductActionSchema.safeParse({ action: "archive", productIds: ids(MAX_BULK_PRODUCTS) }).success).toBe(true);
    expect(bulkProductActionSchema.safeParse({ action: "archive", productIds: ids(MAX_BULK_PRODUCTS + 1) }).success).toBe(false);
    expect(bulkProductActionSchema.safeParse({ action: "archive", productIds: ["p1", "p1"] }).success).toBe(false);
  });

  it("refuses a negative stock and a send to a channel that is not a marketplace", () => {
    expect(
      bulkProductActionSchema.safeParse({ action: "stock", rows: [{ productId: "p1", orgAddressId: "a1", quantity: -1, seenQuantity: 0 }] }).success,
    ).toBe(false);
    expect(bulkProductActionSchema.safeParse({ action: "send", productIds: ["p1"], channel: "store" }).success).toBe(false);
  });

  it("the team must say why; a shop's body may not carry a reason", () => {
    expect(teamBulkProductActionSchema.safeParse(price).success).toBe(false);
    expect(teamBulkProductActionSchema.safeParse({ ...price, reason: "Correcting a typo" }).success).toBe(true);
    expect(bulkProductActionSchema.safeParse({ ...price, reason: "Correcting a typo" }).success).toBe(false);
  });

  // "Select all" (design-system Q35): the list's filters instead of ids, and never both.
  describe("all that match", () => {
    const matching = { action: "archive", matching: { search: "rida", shelf: "available", notReadyOn: "google" } };

    it("accepts the list's filters in place of ids", () => {
      expect(bulkProductActionSchema.safeParse(matching).success).toBe(true);
    });

    it("takes exactly one of ids and filters", () => {
      expect(bulkProductActionSchema.safeParse({ ...matching, productIds: ["p1"] }).success).toBe(false);
      expect(bulkProductActionSchema.safeParse({ action: "archive" }).success).toBe(false);
    });

    it("refuses a shop named inside the filters: the org is the path's", () => {
      expect(bulkProductActionSchema.safeParse({ ...matching, matching: { ...matching.matching, orgId: "another-shop" } }).success).toBe(false);
    });

    it("refuses a channel the platform does not have", () => {
      expect(bulkProductActionSchema.safeParse({ ...matching, matching: { notReadyOn: "ebay" } }).success).toBe(false);
    });

    it("is the shop's own list, never the team's", () => {
      expect(teamBulkProductActionSchema.safeParse({ ...matching, reason: "Tidying up" }).success).toBe(false);
    });
  });
});
