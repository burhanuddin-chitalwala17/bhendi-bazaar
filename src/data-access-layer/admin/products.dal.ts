// lib/data-access/products.dal.ts

import { cache } from "react";
import { productsService } from "@server/catalog/admin.product.service";
import type { ProductDetails, ProductFilters, ProductForTable, ProductStats } from "@/admin/products/types";
import type { Pagination } from "@/types/shared";
import { ProductFlag } from "@/types/shared";
import { loadPriceContext, resolveProductPrice } from "@server/promotions/price-context";

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
    const [{ products, pagination }, context] = await Promise.all([
      productsService.getProducts(filters),
      loadPriceContext(),
    ]);
    return {
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku || "",
        flags: product.flags as ProductFlag[],
        price: product.price,
        salePrice: markdownOf(product, context),
        currency: product.currency,
        rating: product.rating,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        thumbnail: product.thumbnail,
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
      media: product.media ?? [],
      thumbnail: product.thumbnail,
      sizes: product.sizes,
      colors: product.colors,
      org: {
        id: product.org.id,
        name: product.org.name,
        code: product.org.code,
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
}

export const adminProductsDAL = new ProductsDAL();