/**
 * Server-side Product Service
 *
 * This service encapsulates all business logic related to products.
 */

import { productsRepository } from "@server/catalog/product.repository";
import type { ProductFilter } from "@server/catalog/product.types";

export class ProductService {
  /**
   * Get all products with optional filtering
   */
  async getProducts(filter: ProductFilter) {
    // Validate filter
    if (filter) {
      this.validateFilter(filter);
    }

    return await productsRepository.getProducts(filter);
  }

  /**
   * Get a single product by slug
   */
  async getProductBySlug(slug: string) {
    if (!slug || typeof slug !== "string") {
      throw new Error("Invalid product slug");
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
      throw new Error("Invalid product slug");
    }

    if (limit < 1 || limit > 20) {
      throw new Error("Limit must be between 1 and 20");
    }

    return await productsRepository.getSimilarProducts(slug, limit);
  }

  /**
   * Get hero/featured products for homepage
   */
  async getHeroProducts(limit = 6) {
    if (limit < 1 || limit > 20) {
      throw new Error("Limit must be between 1 and 20");
    }

    return await productsRepository.getHeroProducts(limit);
  }

  /**
   * Get products on offer
   */
  async getOfferProducts(limit: number) {
    if (limit !== undefined && (limit < 1 || limit > 50)) {
      throw new Error("Limit must be between 1 and 50");
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
      throw new Error("Search query must be at least 2 characters");
    }

    return await productsRepository.getProducts({
      search: query,
      limit,
    });
  }

  /**
   * Validate product filter
   */
  private validateFilter(filter: ProductFilter): void {
    if (filter.minPrice !== undefined && filter.minPrice < 0) {
      throw new Error("Minimum price cannot be negative");
    }

    if (filter.maxPrice !== undefined && filter.maxPrice < 0) {
      throw new Error("Maximum price cannot be negative");
    }

    if (
      filter.minPrice !== undefined &&
      filter.maxPrice !== undefined &&
      filter.minPrice > filter.maxPrice
    ) {
      throw new Error("Minimum price cannot be greater than maximum price");
    }

    if (filter.limit !== undefined && (filter.limit < 1 || filter.limit > 100)) {
      throw new Error("Limit must be between 1 and 100");
    }

    if (filter.offset !== undefined && filter.offset < 0) {
      throw new Error("Offset cannot be negative");
    }
  }
}

export const productService = new ProductService();

