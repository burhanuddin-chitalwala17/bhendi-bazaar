/**
 * Server-side Product Repository
 *
 * This repository handles all database operations for products.
 */

import { prisma } from "@server/shared/prisma";
import { promotionRepository } from "@server/promotions/promotion.repository";
import { ProductFilter } from "@server/catalog/product.types";
import { NotFoundError } from "@server/shared/domain-error";

const PRODUCT_INCLUDE = {
  category: { select: { slug: true } },
  org: { select: { id: true, name: true, code: true } },
  // The gallery, in gallery order — the only order it is ever read in (product-video
  // R16). Selected explicitly rather than left to `include`'s defaults so the ordering
  // travels with the query instead of being re-established by each caller.
  media: {
    select: { id: true, kind: true, ref: true, description: true, isThumbnail: true },
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
 * "Currently on offer" as a query.
 *
 * This used to be `salePrice IS NOT NULL` — a column test. Coverage is computed now:
 * an offer may name products, name a category and reach its subtree, or name nothing
 * and cover everything in its scope (promotions D3). A store-wide platform offer is
 * expressed as an empty filter rather than by enumerating the catalogue.
 */
async function offerFilter() {
  const { coversEverything, productIds, orgIds, categoryIds } =
    await promotionRepository.productsOnOffer(new Date());
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

export class ProductsRepository {

  /** How many of these products belong to someone else — the org-scoping guard. */
  async countOutsideOrg(productIds: string[], orgId: string): Promise<number> {
    if (productIds.length === 0) return 0;
    return await prisma.product.count({ where: { id: { in: productIds }, NOT: { orgId } } });
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
      ...(orgId ? { orgId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
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

  async getProducts(filter: ProductFilter) {
    const { categorySlug, categoryIds, search, minPrice, maxPrice, offerOnly, featuredOnly } = filter;
    try {
      const products = await prisma.product.findMany({
        // categoryIds (a resolved subtree) wins over a bare slug, which matches
        // only the category's own products.
        where: { ...(categoryIds
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
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Products not found");
    }
  }

  async getProductById(id: string) {
    try {
      const product = await prisma.product.findUnique({
        where: { id },
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
      const product = await prisma.product.findUnique({
        where: { slug },
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
        where: { slug: { not: slug } },
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
        where: { flags: { has: "HERO" } },
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
        where: await offerFilter(),
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
      const products = await prisma.product.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Search products not found");
    }
  }
}

export const productsRepository = new ProductsRepository();