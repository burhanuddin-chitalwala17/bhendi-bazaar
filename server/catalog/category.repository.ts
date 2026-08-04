/**
 * Server-side Category Repository
 *
 * This repository handles all database operations for categories.
 */

import { prisma } from "@server/shared/prisma";
import type { ServerCategory } from "@server/catalog/category.types";

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