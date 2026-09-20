/**
 * Server-side Product Repository
 *
 * This repository handles all database operations for products.
 */

import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import { loadPriceContext } from "@server/promotions/price-context";
import { offerCoverage } from "@server/promotions/targeting";
import { ProductFilter } from "@server/catalog/product.types";
import { NotFoundError } from "@server/shared/domain-error";
import {
  ARCHIVED,
  FROM_ACTIVE_ORG,
  AVAILABLE,
} from "@server/catalog/product.visibility";

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
async function offerFilter() {
  // The request's shared price context, not a fresh query pair: `loadPriceContext`
  // is request-memoised, so this costs nothing here — and the filter now shares the
  // context's clock, so a listing cannot filter by one offer set and label prices
  // with another across an offer boundary.
  const { promotions, categoryParents } = await loadPriceContext();
  const { coversEverything, productIds, orgIds, categoryIds } = offerCoverage(
    promotions,
    categoryParents,
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

/**
 * Stock rows, so a caller inside a `$transaction` passes `tx` and gets the same
 * guarantees. `ProductStock` hangs off a product, so it is reached from here rather
 * than from each domain that needs a unit (ADR-0003).
 */
export type ProductStockDb = Pick<typeof prisma, "productStock">;

/** Enough of the client to read products — `prisma`, or a `$transaction` tx. */
export type ProductDb = Pick<typeof prisma, "product">;

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
      select: { id: true, name: true, price: true, sizes: true, colors: true },
    });
  }

  /**
   * Stock on hand for one product, by location.
   *
   * Active locations only, matching what `PRODUCT_INCLUDE` already treats as sellable:
   * an inactive location's units are held, not offered. Returned per location rather
   * than summed, because a caller taking a unit has to name where from.
   */
  async stockByLocation(productId: string, db: ProductStockDb = prisma) {
    return await db.productStock.findMany({
      where: { productId, orgAddress: { isActive: true }, quantity: { gt: 0 } },
      select: {
        orgAddressId: true,
        quantity: true,
        orgAddress: { select: { name: true } },
      },
      orderBy: { quantity: "desc" },
    });
  }

  /**
   * Take the row lock on this product's stock, without moving any.
   *
   * The `increment: 0` is the entire point and is not a mistake: an UPDATE takes a
   * row-level lock on every row it matches whether or not it changes a value. That
   * makes a caller about to promise this unit to someone serialise against the order
   * path, which locks the same rows when it reserves. Two transactions that never
   * touch a common row cannot see each other, which is how an item comes to be sold
   * and auctioned at the same instant.
   *
   * Returns how many locations still hold stock, so the caller's own check runs behind
   * the lock rather than in front of it.
   */
  async lockStock(
    productId: string,
    db: ProductStockDb = prisma,
  ): Promise<number> {
    const locked = await db.productStock.updateMany({
      where: { productId, quantity: { gte: 1 } },
      data: { quantity: { increment: 0 } },
    });
    return locked.count;
  }

  /**
   * Take one unit from a named location, conditionally (Invariant 6, ADR-0007).
   *
   * `false` means there was nothing there to take — read-then-write would be a race,
   * so the guard and the decrement are one statement.
   */
  async takeOneFromLocation(
    productId: string,
    orgAddressId: string,
    db: ProductStockDb = prisma,
  ): Promise<boolean> {
    const taken = await db.productStock.updateMany({
      where: { productId, orgAddressId, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    return taken.count === 1;
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

  // Nothing a storefront listing renders needs the whole catalogue at once. When the
  // caller gives no limit we still cap the row set: a bare search like `?q=a` otherwise
  // loads every matching product with the full join tree. The service validates an
  // explicit limit to ≤100 (product.service.ts); this bounds the no-limit case.
  private static readonly MAX_LIST_ROWS = 200;

  async getProducts(filter: ProductFilter) {
    const {
      orgId,
      categorySlug,
      categoryIds,
      search,
      minPrice,
      maxPrice,
      offerOnly,
      featuredOnly,
      limit,
      offset,
    } = filter;
    try {
      const products = await prisma.product.findMany({
        relationLoadStrategy: "join",
        // categoryIds (a resolved subtree) wins over a bare slug, which matches
        // only the category's own products.
        where: {
          ...AVAILABLE,
          ...FROM_ACTIVE_ORG,
          // Scoped to one shop when a storefront asks; resolved server-side from the
          // handle, so no query parameter can widen it (ADR-0030 decision 6).
          ...(orgId ? { orgId } : {}),
          ...(categoryIds
            ? { categoryId: { in: categoryIds } }
            : { category: { slug: categorySlug } }),
          ...(search && { name: { contains: search, mode: "insensitive" } }),
          ...(minPrice && { price: { gte: minPrice } }),
          ...(maxPrice && { price: { lte: maxPrice } }),
          ...(offerOnly ? await offerFilter() : {}),
          ...(featuredOnly && { flags: { has: "FEATURED" } }),
        },
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
}

export const productsRepository = new ProductsRepository();
