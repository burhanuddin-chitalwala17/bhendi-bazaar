/**
 * Admin Product Repository
 * Handles database operations for product management
 */

import { prisma } from "@server/shared/prisma";
import type {
    ProductFilters,
    ProductFormInput,
} from "@server/catalog/admin.product.types";
import { ProductFlag } from "@server/catalog/product.flags";
import { Prisma } from "@prisma/client";

// ✅ Efficient select - only fetch needed fields
const PRODUCT_LIST_SELECT = {
    id: true,
    name: true,
    sku: true,
    price: true,
    salePrice: true,
    currency: true,
    rating: true,
    stock: true,
    lowStockThreshold: true,
    flags: true,
    thumbnail: true,
    weight: true,
    createdAt: true,
    category: {
        select: { id: true, name: true },
    },
    seller: {
        select: { id: true, name: true, code: true, defaultPincode: true, defaultCity: true, defaultState: true, defaultAddress: true },
    },
} satisfies Prisma.ProductSelect;

const PRODUCT_DETAILS_SELECT = {
    ...PRODUCT_LIST_SELECT,
    slug: true,
    description: true,
    tags: true,
    images: true,
    sizes: true,
    colors: true,
    shippingFromPincode: true,
    shippingFromCity: true,
    shippingFromLocation: true,
} satisfies Prisma.ProductSelect;

export class ProductsRepository {
    /**
     * Get paginated list of products with filters
     */
    // server/repositories/admin/productRepository.ts

    async getProducts(filters: ProductFilters) {
        const {
            page = 1,
            limit = 20,
            search,
            categoryId,
            sellerId,
            flags,
            lowStock,      // ✅ ADD THIS
            outOfStock,    // ✅ ADD THIS
            sortBy,
            sortOrder,
        } = filters;

        // Build where clause
        const where: Prisma.ProductWhereInput = {
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { sku: { contains: search, mode: "insensitive" } },
                ],
            }),
            ...(categoryId && { categoryId }),
            ...(sellerId && { sellerId }),
            // ✅ OUT OF STOCK FILTER
            ...(outOfStock && { stock: 0 }),
            // ✅ LOW STOCK: exclude zero stock if lowStock filter is active
            ...(lowStock && { stock: { gt: 0 } }),
            ...(flags && { flags: { hasSome: flags } }),
        };

        // Build orderBy
        const orderBy: Prisma.ProductOrderByWithRelationInput =
            sortBy === "name"
                ? { name: sortOrder || "asc" }
                : sortBy === "price"
                    ? { price: sortOrder || "desc" }
                    : sortBy === "stock"
                        ? { stock: sortOrder || "desc" }
                        : { createdAt: "desc" };

        // ✅ If low stock filter, we need to fetch more and filter in-memory
        if (lowStock) {
            const allProducts = await prisma.product.findMany({
                where,
                orderBy,
                select: PRODUCT_LIST_SELECT,
            });

            // Filter products where stock <= lowStockThreshold
            const filteredProducts = allProducts.filter(
                p => p.stock <= p.lowStockThreshold && p.stock > 0
            );

            const total = filteredProducts.length;
            const startIndex = (page - 1) * limit;
            const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

            return {
                products: paginatedProducts,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }

        // ✅ Standard query for other filters
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
                select: PRODUCT_LIST_SELECT,
            }),
            prisma.product.count({ where }),
        ]);

        return {
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Create new product
     */
    async createProduct(data: ProductFormInput) {
        const product = await prisma.product.create({
            data: {
                slug: data.slug,
                name: data.name,
                description: data.description || "",
                price: data.price,
                salePrice: data.salePrice,
                currency: data.currency || "INR",
                sellerId: data.sellerId,
                categoryId: data.categoryId,
                tags: data.tags || [],
                flags: data.flags || [],
                images: data.images,
                thumbnail: data.thumbnail,
                sizes: data.sizes || [],
                colors: data.colors || [],
                stock: data.stock,
                sku: data.sku,
                lowStockThreshold: data.lowStockThreshold || 10,
                shippingFromPincode: data.shippingFromPincode,
                shippingFromCity: data.shippingFromCity,
                shippingFromLocation: data.shippingFromLocation,
            },
            include: {
                category: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        return product
    }

    async getProductById(id: string) {
        return await prisma.product.findUnique({
            where: { id },
            select: PRODUCT_DETAILS_SELECT,
        });
    }

    /**
     * Delete product
     */
    async deleteProduct(id: string) {
        await prisma.product.delete({
            where: { id },
        });
    }

    /**
     * Get product statistics
     */
    async getStats() {
        const [totalProducts, outOfStockProducts, allProducts] = await Promise.all([
            prisma.product.count(),
            prisma.product.count({ where: { stock: 0 } }),
            prisma.product.findMany({
                where: { stock: { gt: 0 } },
                select: {
                    price: true,
                    stock: true,
                    lowStockThreshold: true,
                    flags: true,
                },
            }),
        ]);

        // Filter low stock products and featured products in-memory
        const lowStockProducts = allProducts.filter(
            (p) => p.stock <= p.lowStockThreshold
        ).length;

        const featuredProducts = allProducts.filter((p) =>
            p.flags.includes(ProductFlag.FEATURED)
        ).length;

        const totalInventoryValue = allProducts.reduce((sum, product) => {
            return sum + product.price * product.stock;
        }, 0);

        return {
            totalProducts,
            lowStockProducts,
            outOfStockProducts,
            featuredProducts,
            totalInventoryValue,
        };
    }

    async updateProduct(id: string, data: ProductFormInput) {
        const product = await prisma.product.update({
            where: { id },
            data,
        });
        if (!product) {
            throw new Error("Product not found");
        }
        return product;
    }

}

export const productsRepository = new ProductsRepository();
