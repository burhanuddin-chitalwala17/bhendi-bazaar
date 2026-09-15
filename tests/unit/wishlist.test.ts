// A wishlist stores the fact of the wish, not the product. Pinned here: the row→wire
// mapper (every display field derived from the product join, price through the one
// resolver — ADR-0018), and the schema contracts that make the rows-not-array decision
// enforceable rather than remembered.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toWishlistProduct } from "@server/wishlist/wishlist.repository";
import type { PriceContext } from "@server/promotions/price-context";
import type { EnginePromotion } from "@server/promotions/promotion.types";

const row = {
  id: "wi-1",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  product: {
    id: "prod-1",
    slug: "cream-rida",
    name: "Cream Rida",
    thumbnail: "t.jpg",
    price: 120000,
    orgId: "org-1",
    categoryId: "cat-1",
    lowStockThreshold: 10,
    stockLocations: [] as Array<{ quantity: number }>,
  },
};

/** A live, untargeted 10%-off platform offer — the simplest thing that beats list. */
const tenPercentOff: PriceContext = {
  promotions: [
    {
      id: "promo-1",
      label: "Ten off",
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
      scope: "PLATFORM",
      orgId: null,
      trigger: "AUTOMATIC",
      targets: [],
    } as EnginePromotion,
  ],
  categoryParents: new Map([["cat-1", null]]),
  now: new Date("2026-09-01T00:00:00Z"),
};

describe("toWishlistProduct", () => {
  it("derives every display field from the product — a wishlist cannot hold a stale name or price", () => {
    expect(toWishlistProduct(row)).toMatchObject({
      id: "wi-1",
      productId: "prod-1",
      slug: "cream-rida",
      name: "Cream Rida",
      thumbnail: "t.jpg",
      price: 120000,
      lowStockThreshold: 10,
    });
  });

  it("never fabricates a salePrice when no offer applies", () => {
    expect(toWishlistProduct(row).salePrice).toBeUndefined();
  });

  it("prices through the one resolver, so a saved product cannot advertise a price checkout would refuse", () => {
    // 10% off 120000 paise. Read from the offer, never from a column on the product.
    expect(toWishlistProduct(row, tenPercentOff).salePrice).toBe(108000);
  });

  it("reports one availability figure: the total across active locations", () => {
    const stocked = {
      ...row,
      product: { ...row.product, stockLocations: [{ quantity: 2 }, { quantity: 9 }] },
    };
    expect(toWishlistProduct(stocked).stock).toBe(11);
    expect(toWishlistProduct(row).stock).toBe(0);
  });

  it("carries when it was saved, which an array of ids could not have answered", () => {
    expect(toWishlistProduct(row).savedAt).toEqual(new Date("2026-09-01T10:00:00Z"));
  });
});

describe("the wishlist schema", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  /** One model's body, stopping at its closing brace so a neighbour's doc comment
   *  cannot answer for it. */
  const model = (name: string) => {
    const start = schema.indexOf(`model ${name} {`);
    expect(start).toBeGreaterThan(-1);
    return schema.slice(start, schema.indexOf("\n}", start));
  };

  const wishlistModel = model("Wishlist");
  const itemModel = model("WishlistItem");

  it("saves products as rows, never as an array of ids on the parent", () => {
    expect(wishlistModel).not.toMatch(/productIds/);
    expect(itemModel).toMatch(/productId\s+String\b/);
  });

  it("owns the user link once — no second copy on User to disagree with it", () => {
    expect(wishlistModel).toMatch(/userId\s+String\s+@unique/);
    const user = model("User");
    expect(user).not.toMatch(/wlId/);
    expect(user).toMatch(/wishlist\s+Wishlist\?/);
  });

  it("makes a second heart the same wish, at the database rather than in app code", () => {
    expect(itemModel).toMatch(/@@unique\(\[wishlistId, productId\]\)/);
  });
});

describe("the removal rule: only the heart removes a saved product", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const repo = readFileSync("server/wishlist/wishlist.repository.ts", "utf8");
  const service = readFileSync("server/wishlist/wishlist.service.ts", "utf8");
  const route = readFileSync("src/app/api/wishlist/route.ts", "utf8");
  const checkout = readFileSync("server/checkout/order.service.ts", "utf8");
  const context = readFileSync("src/context/WishlistContext.tsx", "utf8");

  it("has exactly one delete, in the explicit removal", () => {
    // Two delete paths is how a wish disappears without the buyer asking. There is one.
    expect(repo.match(/prisma\.wishlistItem\.deleteMany/g)).toHaveLength(1);
    const body = repo.slice(repo.indexOf("async remove("));
    expect(body).toMatch(/deleteMany/);
    // Scoped to the owner: one person's removal can never reach another's wishlist.
    expect(body).toMatch(/wishlist: \{ userId \}/);
  });

  it("keeps no record of where a product was carted from, because nothing reads one", () => {
    expect(schema).not.toMatch(/cartedFromWishlist/);
    expect(repo).not.toMatch(/cartedFromWishlist/);
    expect(service).not.toMatch(/cartedFromWishlist|removePurchased/);
  });

  it("exposes removal on one route method, and no other write that could clear a wish", () => {
    expect(route).toMatch(/export async function DELETE/);
    expect(route).not.toMatch(/export async function PATCH/);
  });

  it("leaves the wishlist alone when a payment is confirmed", () => {
    // Buying a second one as a gift must not silently forget the first.
    const block = checkout.slice(
      checkout.indexOf("async onPaymentConfirmed"),
      checkout.indexOf("const deliveryAddress")
    );
    expect(block).not.toMatch(/wishlistService/);
  });

  it("gives the client no removal path but the toggle", () => {
    expect(context).not.toMatch(/markCartedFromWishlist/);
    expect(context.match(/method: "DELETE"/g)).toHaveLength(1);
  });
});

describe("the wishlist migration", () => {
  const sql = readFileSync("prisma/migrations/20260907000000_wishlist/migration.sql", "utf8");

  it("a saved product dies with its product (CASCADE), unlike an order line", () => {
    expect(sql).toMatch(
      /WishlistItem_productId_fkey"?\s+FOREIGN KEY \("productId"\) REFERENCES "Product"\("id"\) ON DELETE CASCADE/
    );
  });

  it("a wishlist dies with its user, and its items with it", () => {
    expect(sql).toMatch(
      /Wishlist_userId_fkey"?\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(
      /WishlistItem_wishlistId_fkey"?\s+FOREIGN KEY \("wishlistId"\) REFERENCES "Wishlist"\("id"\) ON DELETE CASCADE/
    );
  });

  it("enforces one wishlist per user and one row per saved product", () => {
    expect(sql).toContain('CREATE UNIQUE INDEX "Wishlist_userId_key" ON "Wishlist"("userId")');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "WishlistItem_wishlistId_productId_key" ON "WishlistItem"("wishlistId", "productId")'
    );
  });
});
