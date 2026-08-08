/**
 * Server-side Category Repository
 *
 * This repository handles all database operations for categories.
 */

import { prisma } from "@server/shared/prisma";
import type { ServerCategory } from "@server/catalog/category.types";
import type { CategoryTreeNode } from "@server/catalog/category.tree";

export class CategoryRepository {
  /**
   * List all categories sorted by order
   */
  async list(): Promise<ServerCategory[]> {
    const categories = await prisma.category.findMany({
      orderBy: [
        {
          order: "asc",
        },
        {
          name: "asc",
        },
      ],
    });
    return categories;
  }

  /**
   * The whole tree as (id, parentId, slug) rows — what the pure helpers in
   * category.tree.ts walk. Tens of rows; loaded whole on purpose (TRD D1).
   */
  async listTree(): Promise<Array<CategoryTreeNode & { slug: string }>> {
    return prisma.category.findMany({
      select: { id: true, parentId: true, slug: true },
    });
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<ServerCategory | null> {
    const category = await prisma.category.findUnique({
      where: { slug },
    });
    return category;
  }

  /**
   * Get category by ID
   */
  async findById(id: string): Promise<ServerCategory | null> {
    const category = await prisma.category.findUnique({
      where: { id },
    });
    return category;
  }
}

export const categoryRepository = new CategoryRepository();