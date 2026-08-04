/**
 * Server-side Category Service
 *
 * This service encapsulates all business logic related to categories.
 */

import { categoryRepository } from "@server/catalog/category.repository";
import type { ServerCategory } from "@server/catalog/category.types";

export class CategoryService {
  /**
   * Get all categories
   */
  async getCategories(): Promise<ServerCategory[]> {
    return await categoryRepository.list();
  }

  /**
   * Get a single category by slug
   */
  async getCategoryBySlug(slug: string): Promise<ServerCategory | null> {
    if (!slug || typeof slug !== "string") {
      throw new Error("Invalid category slug");
    }

    return await categoryRepository.findBySlug(slug);
  }
}

export const categoryService = new CategoryService();

