// lib/data-access/products.dal.ts

import { cache } from "react";
import { productsService } from "@server/catalog/admin.product.service";
import type { ProductDetails, ProductFilters, ProductForTable, ProductStats } from "@/admin/products/types";
import type { Pagination } from "@/types/shared";
import { ProductFlag } from "@/types/shared";

class ProductsDAL {
  // ✅ React cache - deduplicates requests in same render
  getProducts = cache(async (filters: ProductFilters): Promise<{ products: ProductForTable[]; pagination: Pagination }> => {
    const { products, pagination } = await productsService.getProducts(filters);
    return {
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku || "",
        flags: product.flags as ProductFlag[],
        price: product.price,
        salePrice: product.salePrice ?? undefined,
        currency: product.currency,
        rating: product.rating,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        thumbnail: product.thumbnail,
        createdAt: product.createdAt,
        category: product.category,
        seller: product.seller,
      })), pagination
    };
  });

  getStats = cache(async (): Promise<ProductStats> => {
    const stats = await productsService.getStats();
    return {
      totalProducts: stats.totalProducts,
      lowStockProducts: stats.lowStockProducts,
      outOfStockProducts: stats.outOfStockProducts,
      featuredProducts: stats.featuredProducts,
      totalInventoryValue: stats.totalInventoryValue,
    };
  });

  getProductById = cache(async (id: string): Promise<ProductDetails> => {
    const product = await productsService.getProductById({ id });
    if (!product) {
      throw new Error("Product not found");
    }
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: product.price,
      salePrice: product.salePrice ?? undefined,
      currency: product.currency,
      category: product.category,
      tags: product.tags,
      flags: product.flags as ProductFlag[],
      sku: product.sku ?? undefined,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      weight: product.weight ?? 0,
      images: product.images,
      thumbnail: product.thumbnail,
      sizes: product.sizes,
      colors: product.colors,
      seller: {
        id: product.seller.id,
        name: product.seller.name,
        code: product.seller.code,
        defaultPincode: product.seller.defaultPincode,
        defaultCity: product.seller.defaultCity,
        defaultState: product.seller.defaultState,
        defaultAddress: product.seller.defaultAddress ?? "",
      },
      shippingFromPincode: product.shippingFromPincode ?? "",
      shippingFromCity: product.shippingFromCity ?? "",
      shippingFromLocation: product.shippingFromLocation ?? "",
      createdAt: product.createdAt,
    };
  });
}

export const adminProductsDAL = new ProductsDAL();