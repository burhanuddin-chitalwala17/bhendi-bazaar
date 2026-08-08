// The allocation (stock-locations R5/A2/A3, TRD D8): fewest parcels, then nearest.
// These are the spec's own interesting cases, pure: one location covers it; no single
// location covers but the total does; the total is short; ties broken by distance;
// a location holding zero is never chosen. Plus the reservation plan's merge+sort,
// which carries ADR-0007's deadlock discipline onto the join row.
import { describe, expect, it } from "vitest";
import { allocateForOrg, reservationPlan } from "@server/checkout/allocation";

const pincodes = new Map([
  ["shop", "400003"], // Mumbai — same district as the buyer below
  ["godown", "421302"], // Bhiwandi
  ["far", "110001"], // Delhi
]);
const BUYER = "400051";

const line = (productId: string, quantity: number, size?: string) => ({
  productId,
  quantity,
  size,
});
const at = (orgAddressId: string, productId: string, quantity: number) => ({
  orgAddressId,
  productId,
  quantity,
});

describe("allocateForOrg", () => {
  it("one location covers everything → one parcel (A2's 13 stays whole when it can)", () => {
    const parcels = allocateForOrg(
      [line("p1", 2), line("p2", 1)],
      [at("shop", "p1", 5), at("shop", "p2", 3), at("godown", "p1", 1)],
      pincodes,
      BUYER
    );
    expect(parcels).toHaveLength(1);
    expect(parcels[0].orgAddressId).toBe("shop");
  });

  it("splits when no single location covers: 3 at the shop + 10 at the godown fulfils 13 (A3)", () => {
    const parcels = allocateForOrg(
      [line("p1", 13)],
      [at("shop", "p1", 3), at("godown", "p1", 10)],
      pincodes,
      BUYER
    );
    expect(parcels).toHaveLength(2);
    const total = parcels.flatMap((p) => p.lines).reduce((sum, l) => sum + l.quantity, 0);
    expect(total).toBe(13);
    // Greedy clears the most units first: the godown's 10, then the shop's 3.
    expect(parcels[0]).toMatchObject({ orgAddressId: "godown" });
    expect(parcels[1]).toMatchObject({ orgAddressId: "shop" });
  });

  it("refuses when the total is short, naming the product and what is left", () => {
    expect(() =>
      allocateForOrg(
        [line("p1", 13)],
        [at("shop", "p1", 3), at("godown", "p1", 4)],
        pincodes,
        BUYER,
        new Map([["p1", "Cream Rida"]])
      )
    ).toThrow(/Only 7 left of "Cream Rida" — you asked for 13/);
  });

  it("equal covers break toward the nearest origin — shared pincode prefix", () => {
    const parcels = allocateForOrg(
      [line("p1", 2)],
      [at("far", "p1", 5), at("shop", "p1", 5)],
      pincodes,
      BUYER
    );
    // "400003" shares "4000" with the buyer's "400051"; Delhi shares nothing.
    expect(parcels[0].orgAddressId).toBe("shop");
  });

  it("a location holding zero is not chosen", () => {
    const parcels = allocateForOrg(
      [line("p1", 1)],
      [at("shop", "p1", 0), at("godown", "p1", 2)],
      pincodes,
      BUYER
    );
    expect(parcels[0].orgAddressId).toBe("godown");
  });

  it("variant lines split without losing their identity", () => {
    const parcels = allocateForOrg(
      [line("p1", 2, "M"), line("p1", 3, "L")],
      [at("shop", "p1", 4), at("godown", "p1", 1)],
      pincodes,
      BUYER
    );
    const all = parcels.flatMap((p) => p.lines);
    expect(all.filter((l) => l.size === "M").reduce((s, l) => s + l.quantity, 0)).toBe(2);
    expect(all.filter((l) => l.size === "L").reduce((s, l) => s + l.quantity, 0)).toBe(3);
  });
});

describe("reservationPlan", () => {
  it("merges shares of one (product, location) and sorts for lock ordering", () => {
    const plan = reservationPlan([
      { orgAddressId: "godown", lines: [line("p2", 1), line("p1", 2, "M")] },
      { orgAddressId: "shop", lines: [line("p1", 1, "L")] },
      { orgAddressId: "godown", lines: [line("p1", 3, "L")] },
    ]);
    expect(plan).toEqual([
      { productId: "p1", orgAddressId: "godown", quantity: 5 },
      { productId: "p1", orgAddressId: "shop", quantity: 1 },
      { productId: "p2", orgAddressId: "godown", quantity: 1 },
    ]);
  });
});
