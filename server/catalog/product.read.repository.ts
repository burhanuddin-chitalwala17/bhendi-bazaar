/**
 * Server-side Product Repository
 *
 * This repository handles all database operations for products.
 */

import { prisma } from "@server/shared/prisma";
import { MediaAssetState, type Prisma } from "@prisma/client";
import { loadDisplayPriceContext } from "@server/promotions/price-context";
import { offerCoverage } from "@server/promotions/targeting";
import { ProductFilter } from "@server/catalog/product.types";
import { NotFoundError } from "@server/shared/domain-error";
import { ProductFlag } from "@server/catalog/product.flags";
import {
  ARCHIVED,
  FROM_ACTIVE_ORG,
  AVAILABLE,
} from "@server/catalog/product.visibility";

/**
 * The join both product reads add to a gallery row (video-hosting D1): the asset behind a VIDEO
 * row, with its ready derivatives, is what `toProductMediaDto` maps a poster, renditions and a
 * state from. Declared here rather than in `media.ts`, which the browser loads and so cannot
 * name a Prisma enum.
 */
export const PRODUCT_MEDIA_ASSET_SELECT = {
  select: {
    state: true,
    durationMs: true,
    derivatives: {
      where: { state: MediaAssetState.READY },
      select: { ref: true, width: true, height: true, transform: true },
    },
    // The photograph chosen over the worker's frame (video-hosting spec R8); null means the frame.
    posterAsset: { select: { ref: true } },
  },
} satisfies Prisma.ProductMedia$assetArgs;

export const PRODUCT_INCLUDE = {
  category: { select: { slug: true } },
  org: { select: { id: true, name: true, code: true, handle: true } },
  // The gallery, in gallery order — the only order it is ever read in (product-video
  // R16). Selected explicitly rather than left to `include`'s defaults so the ordering
  // travels with the query instead of being re-established by each caller.
  media: {
    select: {
      id: true,
      kind: true,
      ref: true,
      description: true,
      isThumbnail: true,
      slot: true,
      // A hosted video's poster, renditions and state (video-hosting D1); null for anything else.
      asset: PRODUCT_MEDIA_ASSET_SELECT,
    },
    orderBy: { position: "asc" as const },
  },
  // Sellable stock lives on the join rows (stock-locations D3): active locations
  // only — an inactive location's units are held, not offered.
  stockLocations: {
    where: { orgAddress: { isActive: true } },
    select: {
      quantity: true,
      orgAddress: { select: { address: { select: { pincode: true } } } },
    },
  },
};

/**
 * One product with everything a storefront render needs, as the database returns it.
 * Derived from `PRODUCT_INCLUDE` rather than restated — the DAL mapper took `any`
 * before this existed, which let the include tree change shape unnoticed.
 */
export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
}>;

/**
 * "Currently on offer" as a query.
 *
 * This used to be `salePrice IS NOT NULL` — a column test. Coverage is computed now:
 * an offer may name products, name a category and reach its subtree, or name nothing
 * and cover everything in its scope (promotions D3). A store-wide platform offer is
 * expressed as an empty filter rather than by enumerating the catalogue.
 */
async function offerFilter(ownedBy?: string) {
  // The request's shared price context, not a fresh query pair: `loadDisplayPriceContext`
  // is request-memoised, so this costs nothing here — and the filter now shares the
  // context's clock, so a listing cannot filter by one offer set and label prices
  // with another across an offer boundary.
  const { promotions, categoryParents, orgCeilings } = await loadDisplayPriceContext();
  const { coversEverything, productIds, orgIds, categoryIds } = offerCoverage(
    promotions,
    categoryParents,
    orgCeilings,
    ownedBy,
  );
  if (coversEverything) return {};
  const clauses = [
    productIds.length > 0 ? { id: { in: productIds } } : null,
    categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : null,
    orgIds.length > 0 ? { orgId: { in: orgIds } } : null,
  ].filter((clause) => clause !== null);
  // Nothing live: match nothing, rather than silently matching everything.
  if (clauses.length === 0) return { id: { in: [] as string[] } };
  return { OR: clauses };
}

/** Enough of the client to read products — `prisma`, or a `$transaction` tx. */
export type ProductDb = Pick<typeof prisma, "product">;

/** Enough of the client to run a read the query builder cannot express. */
export type RawDb = Pick<typeof prisma, "$queryRaw">;

export class ProductsRepository {
  /**
   * What one product carries that decides whether it can be offered at all —
   * its price to snapshot, and the options a caller may have to choose between.
   */
  async listingFacts(productId: string, orgId: string) {
    return await prisma.product.findFirst({
      // An archived product cannot be listed for bidding either: bidding is a way of
      // selling, and this row is not for sale (ADR-0029).
      where: { id: productId, orgId, ...AVAILABLE },
      select: { id: true, name: true, price: true },
    });
  }

  /**
   * What the order transaction prices and allocates from, read inside that transaction so the
   * price charged is the price checked (Invariant 1). `categoryId` because offers target
   * categories and commission rates resolve by ancestry (ADR-0019).
   */
  /**
   * A product's counts per location and whether it is archived, for sending to its marketplaces
   * (inventory-sync D3). Read on the push's transaction, behind its lock, so it is the count now.
   */
  async stockForPush(productId: string, db: ProductDb = prisma) {
    return db.product.findUnique({
      where: { id: productId },
      select: { id: true, archivedAt: true, stockLocations: { select: { orgAddressId: true, quantity: true } } },
    });
  }

  /**
   * What a marketplace listing is computed from (channel-listings D3, D7), archived included: a
   * listing of an archived product still opens, and its stock goes to 0 through stock sync.
   */
  async forListing(orgId: string, productIds: readonly string[], db: ProductDb = prisma) {
    return await db.product.findMany({
      where: { orgId, id: { in: [...productIds] } },
      select: {
        id: true, orgId: true, name: true, price: true, description: true, keyFeatures: true,
        mrpPaise: true, barcode: true, sku: true, archivedAt: true, familyId: true, categoryId: true,
        productType: true, kind: true, facts: true, weight: true,
        brand: { select: { name: true, manufacturer: true, packerOrImporter: true, countryOfOrigin: true } },
        stockLocations: { select: { quantity: true } },
        media: {
          where: { kind: "IMAGE" },
          orderBy: { position: "asc" },
          select: { id: true, ref: true, assetId: true, asset: { select: { width: true, height: true, mimeType: true } } },
        },
      },
    });
  }

  async checkoutFacts(productIds: string[], db: ProductDb = prisma) {
    return await db.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true, name: true, slug: true, thumbnail: true,
        price: true, weight: true, orgId: true, categoryId: true,
      },
    });
  }

  /**
   * Each product's lowest list price from `since` to now: the price in force at `since`, every
   * price set after it, and today's (offers-hardening D7). One query, however many products.
   * A product with no history at all (none yet backfilled) reads as its current price.
   */
  async lowestListPricesSince(productIds: string[], since: Date, db: RawDb = prisma): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const rows = await db.$queryRaw<Array<{ id: string; lowest: number }>>`
      SELECT p.id, LEAST(
        p.price,
        (SELECT MIN(h."pricePaise") FROM "ProductPriceHistory" h
          WHERE h."productId" = p.id AND h."recordedAt" > ${since}),
        (SELECT h."pricePaise" FROM "ProductPriceHistory" h
          WHERE h."productId" = p.id AND h."recordedAt" <= ${since}
          ORDER BY h."recordedAt" DESC, h.id DESC LIMIT 1)
      )::int AS lowest
      FROM "Product" p WHERE p.id = ANY(${productIds})`;
    return new Map(rows.map((row) => [row.id, row.lowest]));
  }

  /**
   * The categories one org actually sells in (storefront-browse R2).
   *
   * Grouped rather than joined from the category side: the question is about this
   * org's catalogue, so it is asked of the products. Carries the same visibility the
   * listings do, or a shop's bar would offer a category whose every item is hidden.
   */
  async categoryIdsForOrg(orgId: string): Promise<string[]> {
    const rows = await prisma.product.groupBy({
      by: ["categoryId"],
      where: { orgId, ...AVAILABLE, ...FROM_ACTIVE_ORG },
    });
    return rows.map((row) => row.categoryId);
  }

  /** The product type most of this org's goods on sale carry, or null (storefront-themes Q44). */
  async mainProductTypeForOrg(orgId: string): Promise<string | null> {
    const rows = await prisma.product.groupBy({
      by: ["productType"],
      where: { orgId, productType: { not: null }, ...AVAILABLE, ...FROM_ACTIVE_ORG },
      _count: { _all: true },
      orderBy: [{ _count: { productType: "desc" } }, { productType: "asc" }],
      take: 1,
    });
    return rows[0]?.productType ?? null;
  }

  /**
   * Which of these products belong to a withdrawn organisation, by name.
   *
   * The org-level twin of `archivedAmong`: `FROM_ACTIVE_ORG` stops a withdrawn shop's
   * goods being *shown*, and this is what stops them being *bought*. Two queries rather
   * than one because the two refusals say different things to a buyer — an archived
   * item is gone, a withdrawn shop's item may well come back.
   */
  async fromWithdrawnOrgAmong(
    productIds: string[],
    db: ProductDb = prisma,
  ): Promise<string[]> {
    if (productIds.length === 0) return [];
    const rows = await db.product.findMany({
      where: { id: { in: productIds }, org: { isActive: false } },
      select: { name: true },
    });
    return rows.map((row) => row.name);
  }

  /**
   * Which of these products are archived, by name (ADR-0029).
   *
   * Names rather than ids because the only caller shows them to a buyer. Authoritative
   * when handed a `tx`; `product.sale-gate.ts` is what turns it into a refusal.
   */
  async archivedAmong(
    productIds: string[],
    db: ProductDb = prisma,
  ): Promise<string[]> {
    if (productIds.length === 0) return [];
    const rows = await db.product.findMany({
      where: { id: { in: productIds }, ...ARCHIVED },
      select: { name: true },
    });
    return rows.map((row) => row.name);
  }

  /** Whether this product is on sale. AVAILABLE only — unlike `isOnSale`, a withdrawn org's product passes. */
  async isAvailable(id: string): Promise<boolean> {
    const product = await prisma.product.findFirst({
      where: { id, ...AVAILABLE },
      select: { id: true },
    });
    return product !== null;
  }

  /**
   * The products and active-location stock a parcel preview allocates from. Unfiltered: the
   * order transaction is what refuses, so this must still resolve the row it is asked about.
   */
  async listForAllocation(productIds: string[]) {
    const [products, stockRows] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          weight: true,
          orgId: true,
          org: { select: { name: true, code: true } },
        },
      }),
      prisma.productStock.findMany({
        where: {
          productId: { in: productIds },
          quantity: { gt: 0 },
          orgAddress: { isActive: true },
        },
        select: {
          productId: true,
          orgAddressId: true,
          quantity: true,
          orgAddress: {
            select: {
              orgId: true,
              name: true,
              address: { select: { pincode: true, city: true, state: true } },
            },
          },
        },
      }),
    ]);
    return { products, stockRows };
  }

  /**
   * What a cart's stock check needs: each product's name and archive state, and its stock rows at
   * active locations. `archivedAt` rather than an AVAILABLE filter, so an archived product comes
   * back unavailable by name rather than as an unknown one (ADR-0029 D6).
   */
  async listForStockCheck(productIds: string[]) {
    const [products, stockRows] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, archivedAt: true },
      }),
      prisma.productStock.findMany({
        where: { productId: { in: productIds }, orgAddress: { isActive: true } },
        select: { productId: true, quantity: true },
      }),
    ]);
    return { products, stockRows };
  }

  /** How many of these products belong to someone else — the org-scoping guard. */
  async countOutsideOrg(productIds: string[], orgId: string): Promise<number> {
    if (productIds.length === 0) return 0;
    return await prisma.product.count({
      where: { id: { in: productIds }, NOT: { orgId } },
    });
  }

  /** What offer resolution needs about a set of products, and nothing more. */
  async listForPricing(productIds: string[]) {
    if (productIds.length === 0) return [];
    return await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, orgId: true, categoryId: true },
    });
  }

  /**
   * Id and name only — what a target picker needs, one page at a time.
   *
   * Searched and counted at the database rather than filtered in the browser: a
   * capped fetch with client-side filtering silently stops finding products once the
   * catalogue outgrows the cap, and nothing on screen says so.
   */
  async listForPicker({
    orgId,
    search,
    ids,
    limit = 30,
  }: { orgId?: string; search?: string; ids?: string[]; limit?: number } = {}) {
    const where = {
      // An offer cannot be pointed at something that is not for sale.
      ...AVAILABLE,
      ...(orgId ? { orgId } : {}),
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
      // Already-selected products are always included, so a picker never hides a
      // choice the offer has already made just because it is off the current page.
      ...(ids && ids.length > 0 && !search ? {} : {}),
    };
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);
    return { products, total };
  }

  /** The named products, whatever page they would otherwise fall on. */
  async listByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Every product slug, for the sitemap. One lean statement — no relations and no offer
   * resolution, because a URL list needs neither. `getProducts({})` used to serve this,
   * loading the whole join tree and pricing every row to emit a path.
   */
  async listSlugs(): Promise<Array<{ slug: string }>> {
    return await prisma.product.findMany({
      where: { ...AVAILABLE, ...FROM_ACTIVE_ORG, ...FROM_ACTIVE_ORG },
      select: { slug: true },
    });
  }

  /**
   * Every buyable product of these shops, for a channel feed (shopfront-feeds D2). The whole
   * catalogue is the point of a feed, so the cap is a ceiling against a runaway, not a page.
   */
  async listForChannelFeed(orgIds: string[]) {
    if (orgIds.length === 0) return [];
    const rows = await prisma.product.findMany({
      where: { ...AVAILABLE, ...FROM_ACTIVE_ORG, orgId: { in: orgIds } },
      include: { ...PRODUCT_INCLUDE, brand: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: ProductsRepository.MAX_FEED_ROWS,
    });
    if (rows.length === ProductsRepository.MAX_FEED_ROWS) {
      console.warn(`Channel feed hit its ${ProductsRepository.MAX_FEED_ROWS}-row cap; newer products are missing`);
    }
    return rows;
  }

  private static readonly MAX_FEED_ROWS = 10_000;

  // Nothing a storefront listing renders needs the whole catalogue at once. When the
  // caller gives no limit we still cap the row set: a bare search like `?q=a` otherwise
  // loads every matching product with the full join tree. The service validates an
  // explicit limit to ≤100 (product.service.ts); this bounds the no-limit case.
  private static readonly MAX_LIST_ROWS = 200;

  /** The buyer-visible rows a listing filter names; one builder so a count and its page agree. */
  private async listingWhere(filter: ProductFilter): Promise<Prisma.ProductWhereInput> {
    const { orgId, ids, categorySlug, categoryIds, search, minPrice, maxPrice, offerOnly, ownOffersOnly, featuredOnly, heroOnly } = filter;
    return {
      ...AVAILABLE,
      ...FROM_ACTIVE_ORG,
      // Scoped to one shop when a storefront asks; resolved server-side from the
      // handle, so no query parameter can widen it (ADR-0030 decision 6).
      ...(orgId ? { orgId } : {}),
      ...(ids ? { id: { in: ids } } : {}),
      // categoryIds (a resolved subtree) wins over a bare slug, which matches only the category's own products.
      ...(categoryIds ? { categoryId: { in: categoryIds } } : { category: { slug: categorySlug } }),
      ...(search && { name: { contains: search, mode: "insensitive" as const } }),
      // One `price` key: two spreads would let the maximum overwrite the minimum.
      ...((minPrice || maxPrice) && { price: { ...(minPrice && { gte: minPrice }), ...(maxPrice && { lte: maxPrice }) } }),
      ...(offerOnly ? await offerFilter(ownOffersOnly && orgId ? orgId : undefined) : {}),
      ...(featuredOnly && { flags: { has: "FEATURED" } }),
      ...(heroOnly && { flags: { has: ProductFlag.HERO } }),
    };
  }

  /** How many products a listing holds, for its "248 pieces" line; limit and offset do not apply. */
  async countProducts(filter: ProductFilter): Promise<number> {
    return await prisma.product.count({ where: await this.listingWhere(filter) });
  }

  async getProducts(filter: ProductFilter) {
    const { limit, offset } = filter;
    try {
      const products = await prisma.product.findMany({
        relationLoadStrategy: "join",
        where: await this.listingWhere(filter),
        include: {
          ...PRODUCT_INCLUDE,
        },
        // Pagination needs a total order or it is not pagination: Postgres promises
        // nothing about row order without ORDER BY, so `LIMIT 12 OFFSET 12` can hand
        // back rows page one already showed and skip others entirely. `id` is the
        // tiebreak — two products created in the same millisecond would otherwise be
        // free to swap places between requests.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(offset ? { skip: offset } : {}),
        take: limit ?? ProductsRepository.MAX_LIST_ROWS,
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Products not found");
    }
  }

  /**
   * Whether a buyer can reach this product at all — the check a review write needs
   * (product-reviews R7), without loading a gallery to answer it. Spreads the same two
   * fragments every buyer-facing read does, so an archived product and a withdrawn
   * shop's product are equally unreviewable.
   */
  async countOnSaleForOrg(orgId: string): Promise<number> {
    return await prisma.product.count({ where: { orgId, ...AVAILABLE, ...FROM_ACTIVE_ORG } });
  }

  async isOnSale(id: string): Promise<boolean> {
    const count = await prisma.product.count({
      where: { id, ...AVAILABLE, ...FROM_ACTIVE_ORG },
    });
    return count > 0;
  }

  async getProductById(id: string) {
    try {
      const product = await prisma.product.findFirst({
        relationLoadStrategy: "join",
        where: { id, ...AVAILABLE, ...FROM_ACTIVE_ORG },
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return product;
    } catch (error) {
      throw new NotFoundError("Product not found");
    }
  }

  /** Whose a product on sale is, by slug: the one column a product page's chrome needs (storefront-themes D7). */
  async orgIdForSlug(slug: string): Promise<string | null> {
    const row = await prisma.product.findFirst({
      where: { slug, ...AVAILABLE, ...FROM_ACTIVE_ORG },
      select: { orgId: true },
    });
    return row?.orgId ?? null;
  }

  async getProductBySlug(slug: string) {
    try {
      const product = await prisma.product.findFirst({
        relationLoadStrategy: "join",
        where: { slug, ...AVAILABLE, ...FROM_ACTIVE_ORG },
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return product;
    } catch (error) {
      throw new NotFoundError("Product not found");
    }
  }

  async getSimilarProducts(slug: string, count: number) {
    try {
      const products = await prisma.product.findMany({
        relationLoadStrategy: "join",
        where: { slug: { not: slug }, ...AVAILABLE, ...FROM_ACTIVE_ORG },
        orderBy: { createdAt: "desc" },
        take: count,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Similar products not found");
    }
  }

  async getHeroProducts(limit: number) {
    try {
      const products = await prisma.product.findMany({
        relationLoadStrategy: "join",
        where: { flags: { has: "HERO" }, ...AVAILABLE, ...FROM_ACTIVE_ORG },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Hero products not found");
    }
  }

  async getOfferProducts(limit: number) {
    try {
      const products = await prisma.product.findMany({
        relationLoadStrategy: "join",
        where: { ...(await offerFilter()), ...AVAILABLE, ...FROM_ACTIVE_ORG },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Offer products not found");
    }
  }

  async searchProducts(query: string, limit: number) {
    try {
      // Suggestion rows, not product detail: the dropdown renders name, thumbnail
      // and price, so the full include tree here was several queries per keystroke
      // buying data the response never carried.
      const products = await prisma.product.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
          ...AVAILABLE,
          ...FROM_ACTIVE_ORG,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          thumbnail: true,
          price: true,
          // Not rendered: the offer resolver keys on them (ADR-0018).
          orgId: true,
          categoryId: true,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Search products not found");
    }
  }
  async getFamilySiblings(familyId: string) {
    return prisma.product.findMany({
      where: { familyId, archivedAt: null },
      select: { id: true, slug: true, name: true, thumbnail: true, price: true, categoryId: true, orgId: true },
      orderBy: { name: "asc" },
    });
  }
}

export const productsRepository = new ProductsRepository();
