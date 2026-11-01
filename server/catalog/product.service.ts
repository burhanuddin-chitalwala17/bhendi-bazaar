import type { Prisma } from "@prisma/client";
/**
 * Server-side Product Service
 *
 * This service encapsulates all business logic related to products.
 */

import { adminProductsRepository } from "@server/catalog/product.repository";
import { productsRepository, type ProductDb, type RawDb } from "@server/catalog/product.read.repository";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { collectSubtreeIds } from "@server/catalog/category.tree";
import type { ProductFilter, ProductSuggestion } from "@server/catalog/product.types";
import type { MarketplaceEntry, MarketplaceFill, MarketplaceFilled } from "@server/catalog/admin.product.types";
import {
  resolveProductPrice,
  type PriceContext,
} from "@server/promotions/price-context";
import { DomainError } from "@server/shared/domain-error";

export class ProductService {
  /**
   * Get all products with optional filtering
   */
  async getProducts(filter: ProductFilter) {
    // Validate filter
    if (filter) {
      this.validateFilter(filter);
    }

    if (filter?.categorySlug) {
      // A category page lists its whole subtree (category-tree R2). Unknown
      // slug resolves to an empty list, never to "all products".
      const tree = await categoryRepository.listTree();
      const root = tree.find((c) => c.slug === filter.categorySlug);
      return await productsRepository.getProducts({
        ...filter,
        categoryIds: root ? collectSubtreeIds(tree, root.id) : [],
      });
    }

    return await productsRepository.getProducts(filter);
  }

  /**
   * Get a single product by slug
   */
  async getProductBySlug(slug: string) {
    if (!slug || typeof slug !== "string") {
      throw new DomainError("Invalid product slug");
    }

    return await productsRepository.getProductBySlug(slug);
  }

  /**
   * Get similar products for recommendations
   */
  async getSimilarProducts(
    slug: string,
    limit = 4
  ) {
    if (!slug || typeof slug !== "string") {
      throw new DomainError("Invalid product slug");
    }

    if (limit < 1 || limit > 20) {
      throw new DomainError("Limit must be between 1 and 20");
    }

    return await productsRepository.getSimilarProducts(slug, limit);
  }

  /**
   * Get hero/featured products for homepage
   */
  async getHeroProducts(limit = 6) {
    if (limit < 1 || limit > 20) {
      throw new DomainError("Limit must be between 1 and 20");
    }

    return await productsRepository.getHeroProducts(limit);
  }

  /**
   * Get products on offer
   */
  async getOfferProducts(limit: number) {
    if (limit !== undefined && (limit < 1 || limit > 50)) {
      throw new DomainError("Limit must be between 1 and 50");
    }

    return await productsRepository.getOfferProducts(limit);
  }

  /**
   * Search products
   */
  async searchProducts(
    query: string,
    limit = 20
  ) {
    if (!query || typeof query !== "string") {
      return [];
    }

    if (query.length < 2) {
      throw new DomainError("Search query must be at least 2 characters");
    }

    // The lean suggestion read, not the listing read: getProducts carries the
    // full include tree and no row cap, so it answered a dropdown with the
    // entire matching catalogue at detail-page cost.
    return await productsRepository.searchProducts(query, limit);
  }

  /**
   * A shop's products that have a SKU, archived included: what a marketplace listing can link to
   * (channel-import D7, decision Q4).
   */
  async listWithSku(orgId: string): Promise<Array<{ id: string; sku: string | null; name: string; archived: boolean }>> {
    const rows = await adminProductsRepository.listWithSku(orgId);
    return rows.map((row) => ({ id: row.id, sku: row.sku, name: row.name, archived: row.archivedAt !== null }));
  }

  /** A product being matched to a listing, for the Settle page (product-merge R4). Null when not this org's. */
  async settleFacts(orgId: string, id: string) {
    const row = await adminProductsRepository.settleFacts(orgId, id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      description: row.description,
      pricePaise: row.price,
      imageUrl: row.thumbnail,
      photoUrls: row.media.map((m) => m.ref),
      archived: row.archivedAt !== null,
      categoryId: row.categoryId,
      stock: row.stockLocations.map((l) => ({ locationId: l.orgAddressId, quantity: l.quantity })),
    };
  }

  /** Put copied photos on a product, appended or replacing its images (product-merge D6). */
  async setImages(productId: string, orgId: string, refs: string[], mode: "append" | "replace") {
    await adminProductsRepository.setImages(productId, orgId, refs, mode);
  }

  /** What filling from a marketplace and its card read of a product (marketplace-facts D5, D6). Null when not this org's. */
  async marketplaceFacts(orgId: string, id: string) {
    return await adminProductsRepository.marketplaceFacts(orgId, id);
  }

  /** Only what is still empty, under the row's lock (marketplace-facts D7). Null when not this org's. */
  async fillFromMarketplace(orgId: string, id: string, fill: MarketplaceFill, tx?: Prisma.TransactionClient): Promise<MarketplaceFilled | null> {
    return await adminProductsRepository.fillFromMarketplace(orgId, id, fill, tx);
  }

  /** The owner's choice, change or reset of one answer from the card (marketplace-facts D8). */
  async setMarketplaceAnswer(
    orgId: string,
    id: string,
    column: "facts" | "measurements",
    key: string,
    entry: MarketplaceEntry | Record<string, unknown> | null,
    onlyIfEmpty: boolean,
  ) {
    return await adminProductsRepository.setMarketplaceAnswer(orgId, id, column, key, entry as Record<string, unknown> | null, onlyIfEmpty);
  }

  /** A product's counts per location, archived included (inventory-sync D3): an archived product sends 0 (Q6). */
  async stockForPush(productId: string, db?: ProductDb) {
    return await productsRepository.stockForPush(productId, db);
  }

  /** What each product's marketplace listings are computed from (channel-listings D3), archived included. */
  async forListing(orgId: string, productIds: readonly string[], db?: ProductDb) {
    return await productsRepository.forListing(orgId, productIds, db);
  }

  /** A family's members with what each answers, for adding to it (family-merge Q20). */
  async familyMembers(orgId: string, familyId: string) {
    return await adminProductsRepository.familyMembers(orgId, familyId);
  }

  /** An existing product joins a family, conditionally (family-merge D3). */
  async setFamilyIn(tx: Prisma.TransactionClient, orgId: string, id: string, familyId: string, fromFamilyId: string | null): Promise<boolean> {
    return await adminProductsRepository.setFamilyIn(tx, orgId, id, familyId, fromFamilyId);
  }

  /** The category the card's type question chose; the type follows it (marketplace-facts Q25, Q27). */
  async setCategoryFromMarketplace(orgId: string, id: string, categoryId: string, productType: string | null): Promise<boolean> {
    return await adminProductsRepository.setCategoryFromMarketplace(orgId, id, categoryId, productType);
  }

  /** A shop's products by name, archived included, for matching a marketplace listing (product-merge D3). */
  async listForMatching(orgId: string) {
    const rows = await adminProductsRepository.listForMatching(orgId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      pricePaise: row.price,
      imageUrl: row.thumbnail,
      archived: row.archivedAt !== null,
    }));
  }

  /** One product's own values, beside a marketplace listing's (channel-import Q17). Null when not this org's. */
  async compareFacts(orgId: string, id: string) {
    const row = await adminProductsRepository.compareFacts(orgId, id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      pricePaise: row.price,
      imageUrl: row.thumbnail,
      stock: row.stockLocations.reduce((sum, location) => sum + location.quantity, 0),
      archived: row.archivedAt !== null,
    };
  }

  /**
   * One org's products, as a picker offers them — id, name and enough to recognise a row.
   *
   * On the service rather than reachable through the repository because `bidding` asks it when
   * an org chooses what to auction, and a domain is reached through its service
   * ([ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)).
   */
  async listForPicker(args: { orgId: string; search?: string; ids?: string[]; limit?: number }) {
    return await productsRepository.listForPicker(args);
  }

  /**
   * What another domain needs to know before listing a product as something to sell: it exists,
   * it belongs to this org, and it is available. Returns null when any of those fails, so the
   * caller refuses rather than deciding for itself which of the three went wrong.
   *
   * Carries catalog's availability rule, which is the point of asking catalog: an archived
   * product cannot be auctioned either, because bidding is a way of selling and that row is not
   * for sale ([ADR-0029](../../docs/adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)).
   */
  async listingFacts(productId: string, orgId: string) {
    return await productsRepository.listingFacts(productId, orgId);
  }

  /**
   * Whether a buyer may newly save this product. Asked by `wishlist`; a withdrawn org's product
   * still passes, as it did when wishlist read the row itself.
   */
  async isAvailable(productId: string): Promise<boolean> {
    return await productsRepository.isAvailable(productId);
  }

  /**
   * What the order transaction prices and allocates from, read on the caller's `tx` so the
   * price charged is the price checked (Invariant 1). Checkout asks here rather than reading
   * `Product` itself (ADR-0033).
   */
  async checkoutFacts(productIds: string[], db?: ProductDb) {
    return await productsRepository.checkoutFacts(productIds, db);
  }

  /**
   * Each product's lowest list price from `since` to now, which the platform's share of a discount
   * is worked out on (offers-hardening D7, own-store Q21). Read on the order's `tx`.
   */
  async lowestListPrices(productIds: string[], since: Date, db?: RawDb) {
    return await productsRepository.lowestListPricesSince(productIds, since, db);
  }

  /** The rows `/api/checkout/allocate` plans parcels from. Never sent to the browser as stock figures (A9). */
  async listForAllocation(productIds: string[]) {
    return await productsRepository.listForAllocation(productIds);
  }

  /** The rows `/api/products/check-stock` sums into one availability figure per product. */
  async listForStockCheck(productIds: string[]) {
    return await productsRepository.listForStockCheck(productIds);
  }

  /**
   * How many of these products belong to someone other than this org — zero is the only
   * acceptable answer when an org is naming its own products. Asked by `promotions` before it
   * targets an offer, so one shop cannot discount another's goods.
   */
  async countOutsideOrg(productIds: string[], orgId: string): Promise<number> {
    return await productsRepository.countOutsideOrg(productIds, orgId);
  }

  /** Price and owner of each product, for `promotions` to check an offer against a shop's ceiling. */
  async listForPricing(productIds: string[]) {
    return await productsRepository.listForPricing(productIds);
  }

  /**
   * A suggestion row, priced through the one resolver checkout also uses
   * (ADR-0018). Kept pure and separate from the read so the dropdown's price
   * cannot drift from the product page's without a test failing.
   */
  toSuggestion(
    product: {
      id: string;
      slug: string;
      name: string;
      thumbnail: string;
      price: number;
      orgId: string;
      categoryId: string;
    },
    context: PriceContext
  ): ProductSuggestion {
    const { pricePaise, offerPricePaise } = resolveProductPrice(product, context);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      thumbnail: product.thumbnail,
      price: pricePaise,
      salePrice: offerPricePaise < pricePaise ? offerPricePaise : undefined,
    };
  }

  /**
   * Validate product filter
   */
  private validateFilter(filter: ProductFilter): void {
    if (filter.minPrice !== undefined && filter.minPrice < 0) {
      throw new DomainError("Minimum price cannot be negative");
    }

    if (filter.maxPrice !== undefined && filter.maxPrice < 0) {
      throw new DomainError("Maximum price cannot be negative");
    }

    if (
      filter.minPrice !== undefined &&
      filter.maxPrice !== undefined &&
      filter.minPrice > filter.maxPrice
    ) {
      throw new DomainError("Minimum price cannot be greater than maximum price");
    }

    if (filter.limit !== undefined && (filter.limit < 1 || filter.limit > 100)) {
      throw new DomainError("Limit must be between 1 and 100");
    }

    if (filter.offset !== undefined && filter.offset < 0) {
      throw new DomainError("Offset cannot be negative");
    }
  }

  /** How many products match a predicate — the fact correction's preview (ADR-0051 D5). */
  async countProductsWhere(where: Prisma.ProductWhereInput): Promise<number> {
    return await adminProductsRepository.countWhere(where);
  }

  /** The facts of every product matching a predicate — the rows a fact correction rewrites. */
  async listProductFactsWhere(where: Prisma.ProductWhereInput) {
    return await adminProductsRepository.listFactsWhere(where);
  }

  /** Writes each product's facts whole, all-or-nothing. */
  async replaceProductFacts(rows: Array<{ id: string; facts: Record<string, unknown> }>): Promise<void> {
    return await adminProductsRepository.replaceFacts(rows);
  }
}

export const productService = new ProductService();

