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
import { slugCandidates, isUniqueViolation } from "@server/shared/slug";
import { blankToNull } from "@server/shared/nullable";
import { NotFoundError } from "@server/shared/domain-error";

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
    org: {
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
    stockLocations: {
        select: {
            orgAddressId: true,
            quantity: true,
            orgAddress: { select: { name: true } },
        },
    },
} satisfies Prisma.ProductSelect;

export class AdminProductsRepository {
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
            orgId,
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
            ...(orgId && { orgId }),
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
        // The slug is derived from the name, never taken from input, and settled by
        // the unique constraint rather than a prior availability query — checking
        // first is a race the database already arbitrates.
        const candidates = slugCandidates(data.name);
        for (let attempt = 0; ; attempt++) {
            const slug = candidates.next().value as string;
            try {
                return await this.insertProduct(slug, data);
            } catch (error) {
                if (isUniqueViolation(error, "slug") && attempt < 25) continue;
                throw error;
            }
        }
    }

    private async insertProduct(slug: string, data: ProductFormInput) {
        // Dual-write (stock-locations PR 4): the join rows are the future authority,
        // Product.stock keeps the sum so every reader stays correct until the cutover.
        // shippingFrom* is not written — origin now comes from the chosen locations.
        const stockRows = data.stockLocations.filter((row) => row.quantity > 0);
        const totalStock = data.stockLocations.reduce((sum, row) => sum + row.quantity, 0);
        const product = await prisma.product.create({
            data: {
                slug,
                name: data.name,
                description: data.description || "",
                price: data.price,
                salePrice: data.salePrice,
                currency: data.currency || "INR",
                orgId: data.orgId,
                categoryId: data.categoryId,
                tags: data.tags || [],
                flags: data.flags || [],
                images: data.images,
                thumbnail: data.thumbnail,
                sizes: data.sizes || [],
                colors: data.colors || [],
                stock: totalStock,
                sku: blankToNull(data.sku),
                lowStockThreshold: data.lowStockThreshold || 10,
                weight: data.weight,
                stockLocations: {
                    create: stockRows.map((row) => ({
                        orgAddressId: row.orgAddressId,
                        quantity: row.quantity,
                    })),
                },
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
    /**
     * Catalogue statistics, for one org or for the whole platform.
     *
     * The scope is a required argument, and `null` means the whole platform. Making it
     * optional would default to platform-wide, which is the wrong default for a
     * vendor-facing page — and is exactly how an org came to see the platform's product
     * count and inventory value.
     */
    async getStats(orgId: string | null) {
        const scope = orgId ? { orgId } : {};

        const [totalProducts, outOfStockProducts, allProducts] = await Promise.all([
            prisma.product.count({ where: scope }),
            prisma.product.count({ where: { ...scope, stock: 0 } }),
            prisma.product.findMany({
                where: { ...scope, stock: { gt: 0 } },
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
        // Fields are enumerated, not spread: `data` originates from a request body,
        // so spreading it would let any writable column through. `slug` is absent
        // deliberately — it is generated once at creation and then frozen, because
        // changing it would 404 every existing link to the product.
        // Dual-write (stock-locations PR 4): replace the join rows, keep the column
        // as the sum. An admin edit is a full replace, so delete-then-create is the
        // honest semantics — corrections included (R9).
        const stockRows = data.stockLocations.filter((row) => row.quantity > 0);
        const totalStock = data.stockLocations.reduce((sum, row) => sum + row.quantity, 0);
        const product = await prisma.$transaction(async (tx) => {
            await tx.productStock.deleteMany({ where: { productId: id } });
            return tx.product.update({
                where: { id },
                data: {
                    name: data.name,
                    description: data.description,
                    price: data.price,
                    salePrice: data.salePrice,
                    currency: data.currency,
                    orgId: data.orgId,
                    categoryId: data.categoryId,
                    tags: data.tags,
                    flags: data.flags,
                    images: data.images,
                    thumbnail: data.thumbnail,
                    sizes: data.sizes,
                    colors: data.colors,
                    stock: totalStock,
                    sku: blankToNull(data.sku),
                    lowStockThreshold: data.lowStockThreshold,
                    weight: data.weight,
                    stockLocations: {
                        create: stockRows.map((row) => ({
                            orgAddressId: row.orgAddressId,
                            quantity: row.quantity,
                        })),
                    },
                },
            });
        });
        if (!product) {
            throw new NotFoundError("Product not found");
        }
        return product;
    }

}

export const adminProductsRepository = new AdminProductsRepository();
