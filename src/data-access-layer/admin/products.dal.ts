// lib/data-access/products.dal.ts

import { cache } from "react";
import { productsService } from "@server/catalog/admin.product.service";
import type { ProductDetails, ProductFilters, ProductForTable, ProductStats } from "@/components/product/console/types";
import type { Pagination } from "@/types/shared";
import { ProductFlag } from "@/types/shared";
import { loadPriceContext, resolveProductPrice } from "@server/promotions/price-context";
import { wishlistService } from "@server/wishlist/wishlist.service";
import { isRenderableImageUrl, renderableMedia } from "@server/catalog/image-paths";
import { toProductMediaDto } from "@server/catalog/media";
import { parseStoredFacts, parseStoredMeasurements } from "@server/listing/listing-facts";
import { LOGO } from "@/lib/config";
import { NotFoundError } from "@server/shared/domain-error";
import type { ProductCopyOption, ProductCopySource } from "@server/catalog/admin.product.types";

/**
 * A product's sale price, read from its markdown offer rather than a column
 * (promotions D9). Admin sees what a buyer sees, resolved through the same function
 * — a console showing a stale figure is how an org edits the wrong number.
 */
const markdownOf = (
  product: { id: string; price: number; orgId: string; categoryId: string },
  context: Awaited<ReturnType<typeof loadPriceContext>>
): number | undefined => {
  const { pricePaise, offerPricePaise } = resolveProductPrice(product, context);
  return offerPricePaise < pricePaise ? offerPricePaise : undefined;
};

class ProductsDAL {
  // ✅ React cache - deduplicates requests in same render
  getProducts = cache(async (filters: ProductFilters): Promise<{ products: ProductForTable[]; pagination: Pagination }> => {
    // "Wishlisted only" decides which page comes back, so it has to be resolved before
    // the catalog query rather than merged in after it like the demand column. The
    // wishlist domain answers in ids and catalog filters on them, so neither learns to
    // read the other's table (ADR-0012).
    const { wishlistedOnly, ...catalogFilters } = filters;
    const productIds = wishlistedOnly
      ? await wishlistService.listSavedProductIds(filters.orgId)
      : undefined;

    const [{ products, pagination }, context] = await Promise.all([
      productsService.getProducts({ ...catalogFilters, productIds }),
      loadPriceContext(),
    ]);
    // Second round trip, not a join: saves live in the wishlist domain and are read
    // through its service (ADR-0012). Only the ids on this page, so the query is
    // bounded by the page size however large the catalogue grows.
    const saves = await wishlistService.countSavesByProduct(products.map((p) => p.id));
    return {
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku || "",
        flags: product.flags as ProductFlag[],
        price: product.price,
        salePrice: markdownOf(product, context),
        currency: product.currency,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        // A dead store URL would throw in next/image and blank the whole list.
        thumbnail: isRenderableImageUrl(product.thumbnail) ? product.thumbnail : LOGO.ICON,
        wishlistCount: saves.get(product.id) ?? 0,
        archivedAt: product.archivedAt,
        createdAt: product.createdAt,
        category: product.category,
        org: product.org,
      })), pagination
    };
  });

  /** `null` means every org — only a platform page may ask for that. */
  getStats = cache(async (orgId: string | null): Promise<ProductStats> => {
    const stats = await productsService.getStats(orgId);
    return {
      totalProducts: stats.totalProducts,
      familyCount: stats.familyCount,
      archivedProducts: stats.archivedProducts,
      lowStockProducts: stats.lowStockProducts,
      outOfStockProducts: stats.outOfStockProducts,
      featuredProducts: stats.featuredProducts,
      totalInventoryValue: stats.totalInventoryValue,
    };
  });

  getProductById = cache(async (id: string): Promise<ProductDetails> => {
    const [product, context] = await Promise.all([
      productsService.getProductById({ id }),
      loadPriceContext(),
    ]);
    if (!product) {
      throw new Error("Product not found");
    }
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: product.price,
      salePrice: markdownOf(product, context),
      currency: product.currency,
      category: product.category,
      tags: product.tags,
      flags: product.flags as ProductFlag[],
      sku: product.sku ?? undefined,
      // The total across every location, active or not — admin truth (R9/D3).
      stock: product.stockLocations.reduce(
        (sum: number, row: { quantity: number }) => sum + row.quantity,
        0
      ),
      lowStockThreshold: product.lowStockThreshold,
      weight: product.weight ?? 0,
      // Read defensively: a malformed stored shape must not take down the form that would let
      // somebody fix it.
      productType: product.productType ?? null,
      kind: product.kind ?? null,
      familyId: product.familyId ?? null,
      facts: parseStoredFacts(product.facts) as ProductDetails["facts"],
      measurements: parseStoredMeasurements(product.measurements) as ProductDetails["measurements"],
      // Dead photos are dropped rather than shown: they cannot render, and saving the
      // edit form is then what clears them from the row — the re-upload remedy.
      media: renderableMedia((product.media ?? []).map(toProductMediaDto)),
      thumbnail: isRenderableImageUrl(product.thumbnail) ? product.thumbnail : LOGO.ICON,
      org: {
        id: product.org.id,
        name: product.org.name,
        code: product.org.code,
        handle: "a-shop",
      },
      stockLocations: (product.stockLocations ?? []).map(
        (row: { orgAddressId: string; quantity: number; orgAddress: { name: string } }) => ({
          orgAddressId: row.orgAddressId,
          locationName: row.orgAddress.name,
          quantity: row.quantity,
        })
      ),
      createdAt: product.createdAt,
    };
  });

  /**
   * `null` when the id is unknown or another org's: `copyFrom` is a query string anyone
   * can edit, and a stale link should open a blank form rather than an error page.
   */
  getCopySource = cache(async (id: string, orgId: string): Promise<ProductCopySource | null> => {
    try {
      return await productsService.getCopySource(id, orgId);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  });

  getCopyOptions = cache(async (orgId: string): Promise<ProductCopyOption[]> =>
    productsService.listCopyOptions(orgId)
  );
}

export const adminProductsDAL = new ProductsDAL();