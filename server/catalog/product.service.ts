/**
 * Server-side Product Service
 *
 * This service encapsulates all business logic related to products.
 */

import { productsRepository } from "@server/catalog/product.repository";
import { categoryRepository } from "@server/catalog/category.repository";
import { collectSubtreeIds } from "@server/catalog/category.tree";
import type { ProductFilter } from "@server/catalog/product.types";
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
}

export const productService = new ProductService();

