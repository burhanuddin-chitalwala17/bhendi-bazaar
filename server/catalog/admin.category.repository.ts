/**
 * Admin Category Repository
 * Handles database operations for category management
 */

import { prisma } from "@server/shared/prisma";
import type {
  AdminCategory,
  CategoryListFilters,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@server/catalog/admin.category.types";
import { slugCandidates, isUniqueViolation } from "@server/shared/slug";

class AdminCategoryRepository {
  /**
   * Get paginated list of categories with filters
   */
  async getCategories(filters: CategoryListFilters) {
    const {
      search,
      page = 1,
      limit = 20,
      sortBy = "order",
      sortOrder = "asc",
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      prisma.category.count({ where }),
    ]);

    const adminCategories: AdminCategory[] = categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      heroImage: category.heroImage,
      accentColorClass: category.accentColorClass,
      order: category.order,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productsCount: category._count.products,
    }));

    return { categories: adminCategories, total };
  }

  /**
   * Get single category by ID
   */
  async getCategoryById(id: string): Promise<AdminCategory | null> {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) return null;

    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      heroImage: category.heroImage,
      accentColorClass: category.accentColorClass,
      order: category.order,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productsCount: category._count.products,
    };
  }

  /**
   * Create new category
   */
  async createCategory(data: CreateCategoryInput): Promise<AdminCategory> {
    // Get max order if not provided
    let order = data.order;
    if (order === undefined) {
      const maxOrder = await prisma.category.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (maxOrder?.order || 0) + 1;
    }

    // Slug derived from the name, settled by the unique constraint. Fields are
    // enumerated rather than spread: `data` comes from a request body.
    const candidates = slugCandidates(data.name);
    let category;
    for (let attempt = 0; ; attempt++) {
      try {
        category = await prisma.category.create({
          data: {
            slug: candidates.next().value as string,
            name: data.name,
            description: data.description,
            heroImage: data.heroImage,
            accentColorClass: data.accentColorClass,
            order,
          },
          include: {
            _count: {
              select: { products: true },
            },
          },
        });
        break;
      } catch (error) {
        if (isUniqueViolation(error, "slug") && attempt < 25) continue;
        throw error;
      }
    }

    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      heroImage: category.heroImage,
      accentColorClass: category.accentColorClass,
      order: category.order,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productsCount: category._count.products,
    };
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    data: UpdateCategoryInput
  ): Promise<AdminCategory | null> {
    // `slug` is intentionally absent: generated once at creation, then frozen,
    // because changing it would 404 every existing link to the category.
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        heroImage: data.heroImage,
        accentColorClass: data.accentColorClass,
        order: data.order,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      heroImage: category.heroImage,
      accentColorClass: category.accentColorClass,
      order: category.order,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productsCount: category._count.products,
    };
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    await prisma.category.delete({
      where: { id },
    });
  }
}

export const adminCategoryRepository = new AdminCategoryRepository();


