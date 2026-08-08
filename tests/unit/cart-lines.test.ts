// Cart lines are rows (order-and-cart-lines PR 2). Pinned: the sign-in merge as
// pure set logic (device quantity wins), the row→wire mapper that derives every
// display field from the product, and the lift migration's expressions.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mergeCartLines, lineKey } from "@server/cart/cart.merge";
import { toWireCartItem } from "@server/cart/cart.repository";

describe("mergeCartLines — the sign-in merge (D6)", () => {
  const line = (productId: string, quantity: number, size?: string) => ({
    productId,
    quantity,
    size,
  });

  it("is a union: lines only on one side survive", () => {
    const merged = mergeCartLines([line("a", 1)], [line("b", 2)]);
    expect(merged.map((l) => l.productId).sort()).toEqual(["a", "b"]);
  });

  it("the device's quantity wins where a line exists on both sides", () => {
    const merged = mergeCartLines([line("a", 5)], [line("a", 2)]);
    expect(merged).toEqual([line("a", 5)]);
  });

  it("the same product in two sizes is two lines, not one", () => {
    const merged = mergeCartLines([line("a", 1, "M")], [line("a", 2, "L")]);
    expect(merged).toHaveLength(2);
  });

  it("treats missing, null and empty variant as the same line", () => {
    expect(lineKey({ productId: "a" })).toBe(lineKey({ productId: "a", size: null, color: "" }));
  });
});

describe("toWireCartItem", () => {
  const row = {
    id: "ci-1",
    quantity: 2,
    size: "M" as string | null,
    color: null as string | null,
    product: {
      id: "prod-1",
      slug: "cream-rida",
      name: "Cream Rida",
      thumbnail: "t.jpg",
      price: 120000,
      salePrice: null as number | null,
      weight: 0.5 as number | null,
      shippingFromPincode: null as string | null,
      org: {
        id: "org-1",
        name: "Rida House",
        code: "ORG-1",
        defaultPincode: "400003",
        defaultCity: "Mumbai",
        defaultState: "MH",
        defaultAddress: null as string | null,
      },
    },
  };

  it("derives every display field from the product — a cart cannot hold a stale price", () => {
    const item = toWireCartItem(row);
    expect(item).toMatchObject({
      productId: "prod-1",
      productName: "Cream Rida",
      price: 120000,
      quantity: 2,
      size: "M",
      color: undefined,
      weight: 0.5,
    });
  });

  it("falls back to the org's pincode when the product has no override", () => {
    expect(toWireCartItem(row).shippingFromPincode).toBe("400003");
    expect(
      toWireCartItem({
        ...row,
        product: { ...row.product, shippingFromPincode: "110001" },
      }).shippingFromPincode
    ).toBe("110001");
  });
});

describe("the cart-lines lift migration", () => {
  const sql = readFileSync("prisma/migrations/20260810170000_cart_lines/migration.sql", "utf8");

  it("keys rows by line position — two sizes of one product are two blob lines", () => {
    expect(sql).toContain("WITH ORDINALITY");
    expect(sql).toMatch(/md5\(cart_id \|\| ':' \|\| product_id \|\| ':' \|\| line_no\)/);
  });

  it("lifts the choice only: quantity, size, colour — never the blob's price", () => {
    expect(sql).toMatch(/NULLIF\(e\.elem ->> 'size', ''\)/);
    expect(sql).toMatch(/NULLIF\(e\.elem ->> 'color', ''\)/);
    expect(sql).not.toMatch(/'price'/);
  });

  it("skips deleted-product lines loudly and retires the blob to nullable", () => {
    expect(sql).toContain("RAISE NOTICE");
    expect(sql).toMatch(/ALTER TABLE "Cart" ALTER COLUMN "items" DROP NOT NULL/);
  });

  it("a cart line dies with its product (CASCADE), unlike an order line", () => {
    expect(sql).toMatch(
      /CartItem_productId_fkey"?\s+FOREIGN KEY \("productId"\) REFERENCES "Product"\("id"\) ON DELETE CASCADE/
    );
  });
});
