// checkout-links D3, the device half: a link's lines join the cart marked as from it, what was
// already there stays, and the same link added again changes nothing.
import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "@/store/cartStore";
import { mergeCartLines } from "@server/cart/cart.merge";
import type { CartItem } from "@/domain/cart";

const line = (productId: string, quantity = 1): CartItem => ({
  id: `wire-${productId}`,
  productId,
  productSlug: productId,
  productName: productId,
  thumbnail: "/x.webp",
  price: 129_900,
  quantity,
  weight: 0.5,
  shippingFromPincode: "400001",
  org: { id: "org", name: "Shop", code: "S-1", handle: "shop" },
});

describe("adding a checkout link's lines to the cart", () => {
  beforeEach(() => useCartStore.getState().clear());

  it("keeps the scarf already in the cart and marks the kurta as from the link (spec A3)", () => {
    const { id: _id, ...scarf } = line("scarf");
    useCartStore.getState().addItem(scarf);
    useCartStore.getState().addFromLink("link-1", [{ ...line("kurta"), fromLinkId: "link-1" }]);

    const items = useCartStore.getState().items;
    expect(items.map((i) => [i.productId, i.quantity, i.fromLinkId])).toEqual([
      ["scarf", 1, undefined],
      ["kurta", 1, "link-1"],
    ]);
    expect(items[1].id).not.toBe("wire-kurta");
  });

  it("adding the same link again does not add a second kurta (spec A3)", () => {
    useCartStore.getState().addFromLink("link-1", [line("kurta")]);
    useCartStore.getState().addFromLink("link-1", [line("kurta")]);
    expect(useCartStore.getState().items.map((i) => [i.productId, i.quantity])).toEqual([["kurta", 1]]);
  });

  it("a link's line the buyer removed does not come back when the link is added again on this device", () => {
    useCartStore.getState().addFromLink("link-1", [line("kurta"), line("dupatta")]);
    const kurta = useCartStore.getState().items.find((i) => i.productId === "kurta")!;
    useCartStore.getState().removeItem(kurta.id);
    useCartStore.getState().addFromLink("link-1", [line("kurta"), line("dupatta")]);
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(["dupatta"]);
  });

  it("a line already in the cart keeps the larger quantity rather than doubling", () => {
    useCartStore.getState().addFromLink("link-0", [line("kurta", 2)]);
    useCartStore.getState().addFromLink("link-1", [line("kurta", 1)]);
    expect(useCartStore.getState().items.map((i) => [i.quantity, i.fromLinkId])).toEqual([[2, "link-1"]]);
  });

  it("the sign-in merge keeps a link's mark from either side", () => {
    const merged = mergeCartLines(
      [{ productId: "kurta", quantity: 1 }],
      [{ productId: "kurta", quantity: 3, fromLinkId: "link-1" }],
    );
    expect(merged).toEqual([{ productId: "kurta", quantity: 1, fromLinkId: "link-1" }]);
  });
});
