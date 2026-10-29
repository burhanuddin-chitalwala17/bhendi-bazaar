// src/data-access-layer/products.dal.ts

// fetch product direct from the database using repository pattern

import {
  productsRepository,
  type ProductWithRelations,
} from "@server/catalog/product.read.repository";
import { productService } from "@server/catalog/product.service";
import { Product, ProductFilter, effectivePrice } from "@/domain/product";
import type { ProductSibling } from "@/domain/product";
import { PRODUCT_PAGE_SIZE, type ProductSort } from "@/lib/product-paging";
import { toProductFlags } from "@/types/product";

import { NotFoundError } from "@server/shared/domain-error";
import {
  isRenderableImageUrl,
  renderableMedia,
} from "@server/catalog/image-paths";
import { toProductMediaDto } from "@server/catalog/media";
import { LOGO } from "@/lib/config";
import {
  loadPriceContext,
  resolveProductPrice,
  type PriceContext,
} from "@server/promotions/price-context";
import {
  biddingLockFor,
  loadBiddingLockContext,
  type BiddingLockContext,
} from "@server/bidding/bidding-lock";
import {
  loadRatingContext,
  ratingFor,
  type RatingContext,
} from "@server/catalog/review-rating";
export { NotFoundError };

const mapProduct = (
  product: ProductWithRelations,
  context: PriceContext,
  locks: BiddingLockContext,
  ratings: RatingContext,
): Product => {
  // The customer sees one availability figure: the total across active locations
  // (stock-locations R4/R11). The indicative origin for serviceability is the
  // largest holding's pincode — allocation decides the real origin at checkout.
  const stockRows = product.stockLocations ?? [];
  const totalStock = stockRows.reduce(
    (sum: number, row) => sum + row.quantity,
    0,
  );
  const mainRow = [...stockRows].sort((a, b) => b.quantity - a.quantity)[0];
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    // Resolved through the one function checkout also prices with (ADR-0018), so the
    // storefront cannot advertise a price the server would refuse. Markdowns are
    // offers now, so this covers them too — and because both sides start from the
    // list price, they compete rather than compound (ADR-0019).
    salePrice: offerPrice(product, context),
    currency: product.currency,
    categorySlug: product.category.slug,
    tags: product.tags,
    flags: toProductFlags(product.flags),
    // Derived from the published reviews, never a column (R6a, trd.md D3). One query
    // for the whole page, so every tile on it reads the same computation as the
    // product page does.
    rating: ratingFor(ratings, product.id).average,
    reviewsCount: ratingFor(ratings, product.id).count,
    // A URL left on the retired store throws inside next/image and takes the whole
    // page down (OPERATIONS.md "Images left behind"), so it reads as no image here.
    media: renderableMedia((product.media ?? []).map(toProductMediaDto)),
    thumbnail: isRenderableImageUrl(product.thumbnail)
      ? product.thumbnail
      : LOGO.ICON,
    weight: product.weight ?? 0,
    stock: totalStock,
    lowStockThreshold: product.lowStockThreshold,
    options: {
    },
    shippingFromPincode: mainRow?.orgAddress.address.pincode || "",
    org: {
      id: product.org.id,
      name: product.org.name,
      code: product.org.code,
      handle: product.org.handle,
    },
    // One memoised query per request answers this for every product on the page
    // (bidding D8). The product itself carries no mark that it is up for bidding.
    facts: parseFacts(product.facts),
    measurements: parseMeasurements(product.measurements),
    biddingSlug: biddingLockFor(locks, product.id) ?? undefined,
  };
};

function parseFacts(raw: unknown): Record<string, string | number | boolean> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const result: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || !("value" in (v as Record<string, unknown>))) continue;
    const val = (v as { value: unknown }).value;
    if (typeof val === "string" && val !== "") result[k] = val;
    else if (typeof val === "number") result[k] = val;
    else if (typeof val === "boolean") result[k] = val;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseMeasurements(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const result: Record<string, number> = {};
  for (const [key, stored] of Object.entries(raw as Record<string, unknown>)) {
    const value = stored && typeof stored === "object" ? (stored as { value?: unknown }).value : undefined;
    if (typeof value === "number" && value > 0) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** The reduced price a buyer sees, or undefined when nothing applies. */
const offerPrice = (
  product: ProductWithRelations,
  context: PriceContext,
): number | undefined => {
  const { pricePaise, offerPricePaise } = resolveProductPrice(
    {
      id: product.id,
      price: product.price,
      orgId: product.orgId,
      categoryId: product.categoryId,
    },
    context,
  );
  return offerPricePaise < pricePaise ? offerPricePaise : undefined;
};

/**
 * Ratings for exactly the products about to be mapped.
 *
 * A second round trip, not a join: reviews are their own aggregate and reached through
 * their own repository (Invariant 5), the same shape the admin list uses for wishlist
 * saves. Bounded by the rows in hand — which on a price-sorted listing is the
 * repository's row cap rather than one page, the ceiling trd.md D5 names.
 */
const ratingsFor = (products: ProductWithRelations[]): Promise<RatingContext> =>
  loadRatingContext(products.map((product) => product.id));

export const productsDAL = {
  getProducts: async (filter: ProductFilter): Promise<Product[]> => {
    try {
      // Through the service, which expands a category slug to its subtree.
      const [products, context, locks] = await Promise.all([
        productService.getProducts(filter),
        loadPriceContext(),
        loadBiddingLockContext(),
      ]);
      const rows = products.filter((p) => p !== null);
      const ratings = await ratingsFor(rows);
      return rows.map((product) => mapProduct(product, context, locks, ratings));
    } catch (error) {
      throw new Error("Failed to fetch products", { cause: error });
    }
  },

  getProductById: async (id: string): Promise<Product> => {
    try {
      const [product, context, locks] = await Promise.all([
        productsRepository.getProductById(id),
        loadPriceContext(),
        loadBiddingLockContext(),
      ]);
      if (!product) {
        throw new NotFoundError(`No product with id ${JSON.stringify(id)}`);
      }
      return mapProduct(product, context, locks, await ratingsFor([product]));
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error("Failed to fetch product", { cause: error });
    }
  },

  getProductBySlug: async (slug: string): Promise<Product> => {
    try {
      const [product, context, locks] = await Promise.all([
        productsRepository.getProductBySlug(slug),
        loadPriceContext(),
        loadBiddingLockContext(),
      ]);
      if (!product) {
        throw new NotFoundError(`No product with slug ${JSON.stringify(slug)}`);
      }
      const mapped = mapProduct(product, context, locks, await ratingsFor([product]));

      if (product.familyId) {
        const siblings = await productsRepository.getFamilySiblings(product.familyId);
        mapped.siblings = siblings.map((s): ProductSibling => {
          const resolved = resolveProductPrice(
            { id: s.id, price: s.price, categoryId: s.categoryId, orgId: s.orgId },
            context,
          );
          return {
            slug: s.slug,
            name: s.name,
            thumbnail: isRenderableImageUrl(s.thumbnail) ? s.thumbnail : LOGO.ICON,
            price: s.price,
            salePrice: resolved.offerPricePaise ?? undefined,
            isCurrent: s.slug === slug,
          };
        });
      }

      return mapped;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error("Failed to fetch product", { cause: error });
    }
  },

  getSimilarProducts: async (
    slug: string,
    count: number,
  ): Promise<Product[]> => {
    const [products, context, locks] = await Promise.all([
      productsRepository.getSimilarProducts(slug, count),
      loadPriceContext(),
      loadBiddingLockContext(),
    ]);
    const rows = products.filter((p) => p !== null);
    const ratings = await ratingsFor(rows);
    return rows.map((product) => mapProduct(product, context, locks, ratings));
  },

  getOfferProducts: async (limit: number): Promise<Product[]> => {
    const [products, context, locks] = await Promise.all([
      productsRepository.getOfferProducts(limit),
      loadPriceContext(),
      loadBiddingLockContext(),
    ]);
    const rows = products.filter((p) => p !== null);
    const ratings = await ratingsFor(rows);
    return rows.map((product) => mapProduct(product, context, locks, ratings));
  },

  /**
   * One page of a listing, ordered as the shopper asked.
   *
   * The one function behind every product grid — the page that renders the first batch
   * and the route that serves the rest both come through here, so a listing cannot be
   * ordered one way on load and another on scroll.
   *
   * Two paths, because only one of the orders exists in the database:
   *
   * **`newest`** is `ORDER BY createdAt DESC, id DESC` with `LIMIT`/`OFFSET`. Cheap —
   * twelve rows per page, whatever the catalogue's size. This is the default, so the
   * common path stays the cheap one.
   *
   * **The price sorts** are by the offer price, which no column holds: it is resolved
   * per request against the live promotion set (ADR-0018), so the database cannot
   * order by it. The set is fetched under the repository's own row cap, priced,
   * ordered and sliced here. That cap is the honest limit of this approach and it is
   * not a new one — before pagination every listing already loaded up to it.
   */
  getPage: async (
    filter: ProductFilter,
    {
      sort = "newest",
      offset = 0,
      limit = PRODUCT_PAGE_SIZE,
    }: { sort?: ProductSort; offset?: number; limit?: number } = {},
  ): Promise<{ products: Product[]; done: boolean }> => {
    // A caller's own limit/offset would fight the ones below; the page is named here.
    const { limit: _l, offset: _o, ...where } = filter;

    if (sort === "newest") {
      const products = await productsDAL.getProducts({
        ...where,
        limit,
        offset,
      });
      // A short page is the end. Said by the server so the grid never has to guess.
      return { products, done: products.length < limit };
    }

    const all = await productsDAL.getProducts(where);
    const direction = sort === "price-asc" ? 1 : -1;
    const ordered = [...all].sort((a, b) => {
      const byPrice = (effectivePrice(a) - effectivePrice(b)) * direction;
      // A total order, so paging cannot repeat or skip a row: two items at the same
      // price would otherwise be free to swap places between requests.
      return byPrice !== 0 ? byPrice : a.id.localeCompare(b.id);
    });

    return {
      products: ordered.slice(offset, offset + limit),
      done: offset + limit >= ordered.length,
    };
  },

  /** Slugs only, for the sitemap — no relations, no offer resolution. */
  listSlugs: async (): Promise<string[]> => {
    const rows = await productsRepository.listSlugs();
    return rows.map((row) => row.slug);
  },

  /**
   * These shops' buyable products, priced and judged exactly as the product page is
   * (shopfront-feeds D2), with the type, kind and brand a channel feed needs beside them.
   */
  listForChannelFeed: async (orgIds: string[]): Promise<ChannelFeedProduct[]> => {
    const [rows, context, locks] = await Promise.all([
      productsRepository.listForChannelFeed(orgIds),
      loadPriceContext(),
      loadBiddingLockContext(),
    ]);
    const ratings = await ratingsFor(rows);
    return rows.map((row) => ({
      product: mapProduct(row, context, locks, ratings),
      productType: row.productType,
      kind: row.kind,
      brandName: row.brand?.name ?? null,
    }));
  },
};

export interface ChannelFeedProduct {
  product: Product;
  productType: string | null;
  kind: string | null;
  brandName: string | null;
}
