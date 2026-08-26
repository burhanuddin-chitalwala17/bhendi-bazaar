/**
 * Server-side Category Service
 *
 * This service encapsulates all business logic related to categories.
 */

import { categoryRepository } from "@server/catalog/category.repository";
import type { ServerCategory } from "@server/catalog/category.types";
import {
  collectAncestorIds,
  flattenDescendantIds,
} from "@server/catalog/category.tree";
import { DomainError } from "@server/shared/domain-error";

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
      throw new DomainError("Invalid category slug");
    }

    return await categoryRepository.findBySlug(slug);
  }

  /**
   * The lane row for a page: every category beneath `slug`, or the whole tree for
   * the home page (`null`). Descend-only — the category itself, its ancestors and
   * its siblings are all absent, so the row shrinks with each descent and a leaf
   * gets an empty array.
   *
   * An unknown slug matches nothing rather than everything, the same way subtree
   * product reads behave (category-tree TRD D1).
   */
  async getDescendants(slug: string | null): Promise<ServerCategory[]> {
    const categories = await categoryRepository.list();

    let rootId: string | null = null;
    if (slug !== null) {
      const root = categories.find((category) => category.slug === slug);
      if (!root) return [];
      rootId = root.id;
    }

    const byId = new Map(categories.map((category) => [category.id, category]));
    return flattenDescendantIds(categories, rootId).flatMap((id) => {
      const category = byId.get(id);
      return category ? [category] : [];
    });
  }

  /**
   * Root-first trail of ancestors, excluding the category itself. Nothing in the
   * lane row points upwards, so this is a category page's only route back.
   */
  async getAncestors(slug: string): Promise<ServerCategory[]> {
    const categories = await categoryRepository.list();
    const category = categories.find((entry) => entry.slug === slug);
    if (!category) return [];

    const byId = new Map(categories.map((entry) => [entry.id, entry]));
    return collectAncestorIds(categories, category.id).flatMap((id) => {
      const ancestor = byId.get(id);
      return ancestor ? [ancestor] : [];
    });
  }
}

export const categoryService = new CategoryService();
