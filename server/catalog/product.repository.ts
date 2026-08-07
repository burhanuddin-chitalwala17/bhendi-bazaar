/**
 * Server-side Product Repository
 *
 * This repository handles all database operations for products.
 */

import { prisma } from "@server/shared/prisma";
import { ProductFilter } from "@server/catalog/product.types";
import { NotFoundError } from "@server/shared/domain-error";

const PRODUCT_INCLUDE = {
  category: { select: { slug: true } },
  org: { select: { id: true, name: true, code: true, defaultPincode: true, defaultCity: true, defaultState: true, defaultAddress: true } },
};

export class ProductsRepository {

  async getProducts(filter: ProductFilter) {
    const { categorySlug, search, minPrice, maxPrice, offerOnly, featuredOnly } = filter;
    try {
      const products = await prisma.product.findMany({
        where: { category: { slug: categorySlug },
          ...(search && { name: { contains: search, mode: "insensitive" } }),
          ...(minPrice && { price: { gte: minPrice } }),
          ...(maxPrice && { price: { lte: maxPrice } }),
          ...(offerOnly && { salePrice: { not: null } }),
          ...(featuredOnly && { flags: { has: "FEATURED" } }),
        },
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Products not found");
    }
  }

  async getProductById(id: string) {
    try {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return product;
    } catch (error) {
      throw new NotFoundError("Product not found");
    }
  }

  async getProductBySlug(slug: string) {
    try {
      const product = await prisma.product.findUnique({
        where: { slug },
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return product;
    } catch (error) {
      throw new NotFoundError("Product not found");
    }
  }

  async getSimilarProducts(slug: string, count: number) {
    try {
      const products = await prisma.product.findMany({
        where: { slug: { not: slug } },
        orderBy: { createdAt: "desc" },
        take: count,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Similar products not found");
    }
  }

  async getHeroProducts(limit: number) {
    try {
      const products = await prisma.product.findMany({
        where: { flags: { has: "HERO" } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Hero products not found");
    }
  }

  async getOfferProducts(limit: number) {
    try {
      const products = await prisma.product.findMany({
        where: { salePrice: { not: null } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Offer products not found");
    }
  }

  async searchProducts(query: string, limit: number) {
    try {
      const products = await prisma.product.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          ...PRODUCT_INCLUDE,
        },
      });
      return products;
    } catch (error) {
      throw new NotFoundError("Search products not found");
    }
  }
}

export const productsRepository = new ProductsRepository();