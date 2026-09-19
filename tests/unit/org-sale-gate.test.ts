/**
 * A withdrawn shop's goods are refused, not merely hidden (org-withdrawal R5, H2).
 *
 * `FROM_ACTIVE_ORG` keeps them off every listing, which handles the shopper who
 * browses. This covers the two it cannot: a buyer holding a link from before, and a
 * basket filled before the switch was thrown.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const fromWithdrawnOrgAmong = vi.fn();
vi.mock("@server/catalog/product.repository", () => ({
  productsRepository: {
    fromWithdrawnOrgAmong: (...args: unknown[]) => fromWithdrawnOrgAmong(...args),
  },
}));

const { assertOrgNotWithdrawn } = await import("@server/catalog/org.sale-gate");

describe("assertOrgNotWithdrawn", () => {
  beforeEach(() => fromWithdrawnOrgAmong.mockReset());

  it("lets an order through when every shop is open", async () => {
    fromWithdrawnOrgAmong.mockResolvedValue([]);
    await expect(assertOrgNotWithdrawn(["p1", "p2"])).resolves.toBeUndefined();
  });

  it("refuses when one line is from a withdrawn shop, and names it", async () => {
    fromWithdrawnOrgAmong.mockResolvedValue(["Kurta"]);
    await expect(assertOrgNotWithdrawn(["p1"])).rejects.toThrow(/Kurta/);
  });

  it("says the shop is shut rather than that the item is gone", async () => {
    // A withdrawal is usually temporary and the product itself is fine — telling a
    // buyer it no longer exists would be wrong, and is what `assertNotArchived` says.
    fromWithdrawnOrgAmong.mockResolvedValue(["Kurta"]);
    await expect(assertOrgNotWithdrawn(["p1"])).rejects.toThrow(/not currently open/i);
  });

  it("counts them when several lines are affected", async () => {
    fromWithdrawnOrgAmong.mockResolvedValue(["Kurta", "Abaya", "Attar"]);
    await expect(assertOrgNotWithdrawn(["p1", "p2", "p3"])).rejects.toThrow(/3 items/);
  });

  it("asks nothing of the database for an empty order", async () => {
    fromWithdrawnOrgAmong.mockResolvedValue([]);
    await assertOrgNotWithdrawn([]);
    expect(fromWithdrawnOrgAmong).toHaveBeenCalledWith([], undefined);
  });

  it("passes the transaction through, so the check shares the order's lock", async () => {
    fromWithdrawnOrgAmong.mockResolvedValue([]);
    const tx = { product: {} } as never;
    await assertOrgNotWithdrawn(["p1"], tx);
    expect(fromWithdrawnOrgAmong).toHaveBeenCalledWith(["p1"], tx);
  });
});
