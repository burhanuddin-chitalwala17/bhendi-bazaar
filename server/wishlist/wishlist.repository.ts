import { prisma } from "@server/shared/prisma";
import type { WishlistProduct } from "@server/wishlist/wishlist.types";
import {
  loadPriceContext,
  resolveProductPrice,
  EMPTY_PRICE_CONTEXT,
  type PriceContext,
} from "@server/promotions/price-context";

/**
 * Wishlist repository — the only place `prisma.wishlist` / `prisma.wishlistItem` are
 * touched (ADR-0003, Invariant 5).
 *
 * The parent row is created lazily on the first save, so a user who has never hearted
 * anything owns no row. Saving is one insert guarded by `@@unique(wishlistId,
 * productId)`: a double click is absorbed by the database rather than by a
 * read-then-write the second device would lose.
 */

const ITEM_INCLUDE = {
  product: {
    include: {
      stockLocations: {
        where: { orgAddress: { isActive: true } },
        select: { quantity: true },
      },
    },
  },
} as const;

interface WishlistItemRow {
  id: string;
  createdAt: Date;
  product: {
    id: string;
    slug: string;
    name: string;
    thumbnail: string;
    price: number;
    orgId: string;
    categoryId: string;
    lowStockThreshold: number;
    stockLocations: Array<{ quantity: number }>;
  };
}

/**
 * Exported for tests: the saved row plus everything the product answers for.
 *
 * Prices come from the resolver the product page and checkout use (ADR-0018) — a
 * wishlist is a display surface, and one showing a price offers have already moved is
 * exactly the divergence that ADR exists to prevent.
 */
export function toWishlistProduct(
  row: WishlistItemRow,
  context: PriceContext = EMPTY_PRICE_CONTEXT
): WishlistProduct {
  const { pricePaise, offerPricePaise } = resolveProductPrice(
    {
      id: row.product.id,
      price: row.product.price,
      orgId: row.product.orgId,
      categoryId: row.product.categoryId,
    },
    context
  );
  return {
    id: row.id,
    productId: row.product.id,
    slug: row.product.slug,
    name: row.product.name,
    thumbnail: row.product.thumbnail,
    price: row.product.price,
    salePrice: offerPricePaise < pricePaise ? offerPricePaise : undefined,
    // The customer sees one availability figure: the total across active locations,
    // as the storefront DAL reports it (stock-locations R4/R11).
    stock: row.product.stockLocations.reduce((sum, loc) => sum + loc.quantity, 0),
    lowStockThreshold: row.product.lowStockThreshold,
    savedAt: row.createdAt,
  };
}

export class WishlistRepository {
  /** Newest first — a wishlist is read as "what I saved recently". */
  async listByUserId(userId: string): Promise<WishlistProduct[]> {
    try {
      const rows = await prisma.wishlistItem.findMany({
        relationLoadStrategy: "join",
        where: { wishlist: { userId } },
        include: ITEM_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      const context = await loadPriceContext();
      return rows.map((row) => toWishlistProduct(row, context));
    } catch (error) {
      console.error("[WishlistRepository] listByUserId failed:", error);
      throw new Error("Failed to fetch wishlist from database", { cause: error });
    }
  }

  /**
   * Just the saved ids, for painting hearts across a listing.
   *
   * Deliberately no product join: the caller already holds the products it is
   * rendering and only needs to know which of them are saved.
   */
  async listProductIds(userId: string): Promise<string[]> {
    try {
      const rows = await prisma.wishlistItem.findMany({
        where: { wishlist: { userId } },
        select: { productId: true },
      });
      return rows.map((row) => row.productId);
    } catch (error) {
      console.error("[WishlistRepository] listProductIds failed:", error);
      throw new Error("Failed to fetch wishlist from database", { cause: error });
    }
  }

  /**
   * How many users have saved each of these products.
   *
   * Serves the org and admin product tables, which want demand beside stock. Scoped to
   * the ids on the page rather than the whole catalogue, and grouped in SQL on
   * `@@index([productId])` — the alternative, a `_count` on the product `select`, would
   * reference `WishlistItem` from the catalog repository and give this table a second
   * reader (ADR-0003).
   *
   * A product nobody saved is absent from the result, not zero: the caller defaults it,
   * because "no row" and "zero saves" are the same fact and only one of them is stored.
   */
  async countByProductIds(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    try {
      const rows = await prisma.wishlistItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _count: { _all: true },
      });
      return new Map(rows.map((row) => [row.productId, row._count._all]));
    } catch (error) {
      console.error("[WishlistRepository] countByProductIds failed:", error);
      throw new Error("Failed to count wishlist saves", { cause: error });
    }
  }

  /**
   * Every product at least one person has saved, optionally within one org.
   *
   * Answers the product tables' "wishlisted only" filter. It has to be the whole set
   * rather than a page: the filter decides *which* page the catalog query returns, so
   * it must be known before that query runs — unlike the demand column, which is
   * merged in after. The org scope is what keeps it bounded in the portal; the
   * platform view asks for all of them, which is the price of not letting catalog
   * join `WishlistItem` itself (ADR-0003).
   */
  async listSavedProductIds(orgId?: string): Promise<string[]> {
    try {
      const rows = await prisma.wishlistItem.findMany({
        where: orgId ? { product: { orgId } } : undefined,
        select: { productId: true },
        distinct: ["productId"],
      });
      return rows.map((row) => row.productId);
    } catch (error) {
      console.error("[WishlistRepository] listSavedProductIds failed:", error);
      throw new Error("Failed to read saved products", { cause: error });
    }
  }

  /**
   * Save a product. Idempotent: hearting something already saved changes nothing and
   * is not an error, because from the buyer's side the wish is already recorded.
   */
  async add(userId: string, productId: string): Promise<void> {
    const wishlist = await prisma.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });
    await prisma.wishlistItem.createMany({
      data: [{ wishlistId: wishlist.id, productId }],
      skipDuplicates: true,
    });
  }

  /**
   * Remove a saved product — the only path that deletes a saved row. Nothing else in
   * the app forgets a wish: not carting it, not buying it, not the product selling
   * out. A saved product leaves the wishlist when the buyer un-hearts it, and never
   * otherwise.
   *
   * `deleteMany` rather than `delete` so removing something
   * already gone is a no-op instead of a thrown 404 — two tabs un-hearting the same
   * product both succeed, which is what the user meant either way.
   *
   * The parent row is left behind: an empty wishlist is a wishlist the user will
   * likely fill again, and deleting it would only buy a row back later.
   */
  async remove(userId: string, productId: string): Promise<void> {
    try {
      await prisma.wishlistItem.deleteMany({
        where: { productId, wishlist: { userId } },
      });
    } catch (error) {
      console.error("[WishlistRepository] remove failed:", error);
      throw new Error("Failed to remove the item from your wishlist", { cause: error });
    }
  }
}

export const wishlistRepository = new WishlistRepository();
