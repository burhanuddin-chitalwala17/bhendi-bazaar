// A product's read-only view lists where its stock is held (stock-locations R9). It used to pass no
// locations, so every product read "Where is this kept? Add your shop address once." and "Total: 0".
import { describe, expect, it } from "vitest";

import { heldAt } from "@/components/product/console/ProductsView";

describe("a product's read-only view", () => {
  it("shows each location holding its stock, with where it is", () => {
    const rows = heldAt({ stockLocations: [{ orgAddressId: "a1", locationName: "Shop", city: "Mumbai", pincode: "400003", isActive: true, quantity: 1 }] });
    expect(rows).toEqual([{ id: "a1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true }]);
  });

  it("shows nothing only when the product truly has no location", () => {
    expect(heldAt({ stockLocations: [] })).toEqual([]);
  });
});
