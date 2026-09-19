// An order removes from the cart only what it bought (seamless-sign-in D12, R16):
// cart and Buy Now alike, with the version bumped so a stale tab conflicts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";

vi.mock("@server/shared/prisma", () => ({ prisma: {} }));
import { cartRepository } from "@server/cart/cart.repository";
import { useCartStore } from "@/store/cartStore";
import type { CartItem } from "@/domain/cart";

function fakeTx(cart: { id: string } | null) {
  const tx = {
    cart: {
      findUnique: vi.fn().mockResolvedValue(cart),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn(),
    },
    cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return { tx, asTx: tx as unknown as Prisma.TransactionClient };
}

describe("cartRepository.removeLinesIn — the order transaction's cart step", () => {
  it("deletes only the bought (product, size, colour) lines, empty variants as null", async () => {
    const { tx, asTx } = fakeTx({ id: "cart-1" });
    await cartRepository.removeLinesIn(asTx, "user-1", [
      { productId: "a", size: "M" },
      { productId: "b", size: "", color: undefined },
    ]);

    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: {
        cartId: "cart-1",
        OR: [
          { productId: "a", size: "M", color: null },
          { productId: "b", size: null, color: null },
        ],
      },
    });
    // Never the whole cart: the row survives, holding whatever was not bought.
    expect(tx.cart.deleteMany).not.toHaveBeenCalled();
  });

  it("bumps the version so a stale write from another tab conflicts", async () => {
    const { tx, asTx } = fakeTx({ id: "cart-1" });
    await cartRepository.removeLinesIn(asTx, "user-1", [{ productId: "a" }]);
    expect(tx.cart.update).toHaveBeenCalledWith({
      where: { id: "cart-1" },
      data: { version: { increment: 1 } },
    });
  });

  it("does nothing for an account with no cart — a Buy Now from an empty one", async () => {
    const { tx, asTx } = fakeTx(null);
    await cartRepository.removeLinesIn(asTx, "user-1", [{ productId: "a" }]);
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.cart.update).not.toHaveBeenCalled();
  });

  it("is what the order transaction calls, not a direct tx.cart write (ADR-0003)", () => {
    const source = readFileSync("server/checkout/order.service.ts", "utf8");
    expect(source).not.toMatch(/tx\.cart\./);
    expect(source).toMatch(/cartService\.removeBoughtLinesIn\(tx, input\.userId, requestedLines\)/);
  });
});

describe("cart store removeLines — the client drops the same lines", () => {
  const item = (id: string, productId: string, size?: string): CartItem =>
    ({ id, productId, size, quantity: 1, price: 1000, productName: productId } as CartItem);

  beforeEach(() => useCartStore.getState().setItems([]));

  it("keeps what was not bought (A11: C stays after paying for A and B)", () => {
    useCartStore.getState().setItems([item("1", "A"), item("2", "B"), item("3", "C")]);
    useCartStore.getState().removeLines([{ productId: "A" }, { productId: "B" }]);
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(["C"]);
  });

  it("a Buy Now of B leaves A in the cart (A12)", () => {
    useCartStore.getState().setItems([item("1", "A")]);
    useCartStore.getState().removeLines([{ productId: "B" }]);
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(["A"]);
  });

  it("matches the variant, not just the product", () => {
    useCartStore.getState().setItems([item("1", "A", "M"), item("2", "A", "L")]);
    useCartStore.getState().removeLines([{ productId: "A", size: "M" }]);
    expect(useCartStore.getState().items.map((i) => i.size)).toEqual(["L"]);
  });
});
