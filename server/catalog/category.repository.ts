/**
 * Server-side Category Repository
 *
 * This repository handles all database operations for categories.
 */

import { cache } from "react";
import { prisma } from "@server/shared/prisma";
import type { Category } from "@prisma/client";
import type { ServerCategory } from "@server/catalog/category.types";
import type { CategoryTreeNode } from "@server/catalog/category.tree";

/**
 * The whole table, once per request. Tens of rows, and a single category page used
 * to read them four times in four shapes (slug lookup, subtree walk, parents map,
 * offer filter) — four billed operations for one small table. Every reader below
 * derives from this one request-memoised query instead. Same pattern and request
 * scope as loadPriceContext; deliberately memoised no further than a request.
 */
const allCategories = cache(async (): Promise<Category[]> => {
  return prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
});

export class CategoryRepository {
  /** Id, name and slug — what a bulk sheet needs to resolve a `parent` cell to a
   *  category. Name as well as slug, because a renamed category keeps its original
   *  slug (Invariant 4) and the two stop being derivable from each other. */
  async listIdentifiers(): Promise<Array<{ id: string; name: string; slug: string }>> {
    const categories = await allCategories();
    return categories.map(({ id, name, slug }) => ({ id, name, slug }));
  }

  /** Id and name only — what a target picker needs. */
  async listForPicker() {
    const categories = await allCategories();
    return categories
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async list(): Promise<ServerCategory[]> {
    return await allCategories();
  }

  /**
   * The whole tree as (id, parentId, slug) rows — what the pure helpers in
   * category.tree.ts walk. Tens of rows; loaded whole on purpose (TRD D1).
   */
  async listTree(): Promise<Array<CategoryTreeNode & { slug: string }>> {
    const categories = await allCategories();
    return categories.map(({ id, parentId, slug }) => ({ id, parentId, slug }));
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<ServerCategory | null> {
    const categories = await allCategories();
    return categories.find((category) => category.slug === slug) ?? null;
  }

  /**
   * Get category by ID
   */
  async findById(id: string): Promise<ServerCategory | null> {
    const categories = await allCategories();
    return categories.find((category) => category.id === id) ?? null;
  }
}

export const categoryRepository = new CategoryRepository();