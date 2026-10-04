/**
 * Admin Product Repository
 * Handles database operations for product management
 */

import { prisma } from "@server/shared/prisma";
import type {
    ProductFilters,
    ProductFormInput,
    ProductPersistInput,
} from "@server/catalog/admin.product.types";
import { ProductFlag } from "@server/catalog/product.flags";
import { Prisma } from "@prisma/client";
import { slugCandidates, isUniqueViolation } from "@server/shared/slug";
import { blankToNull } from "@server/shared/nullable";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { ARCHIVED, AVAILABLE, shelfFilter } from "@server/catalog/product.visibility";
import { PRODUCT_MEDIA_ASSET_SELECT, productsRepository } from "@server/catalog/product.repository";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { coverOf, type MediaKind, type ProductMediaInput } from "@server/catalog/media";
import { mediaAssetRepository, type MediaDb } from "@server/catalog/media-asset.repository";

/**
 * Pure, exported for tests: media rows for a Prisma nested create, in submitted order, plus the `thumbnail` the
 * cover resolves to.
 *
 * The two are built together and written together because they must never disagree
 * (D4b): `thumbnail` is a cache of the cover's `ref`, not an input. `coverOf` throws if
 * no item is flagged rather than falling back to the first image — a fallback here is
 * how an unset cover becomes survivable instead of loud (D4a).
 */
/**
 * The asset behind each row (media-library trd D1). A stored file — a photograph or a hosted
 * video — is found by URL; a photograph with no ready asset links to nothing and the backfill
 * catches it later, so the write never waits on it. A YouTube video is the org's own reference,
 * created the moment a gallery first names it (R5a), because nothing else ever will. Exported
 * for tests.
 */
export async function withAssetIds<T extends { kind: MediaKind; ref: string }>(
    rows: T[],
    orgId: string,
    db: MediaDb = prisma,
) {
    const imageIds = await mediaAssetRepository.idsByRefs(
        rows.filter((row) => row.kind !== "YOUTUBE").map((row) => row.ref),
        db,
    );
    const videoRefs = [...new Set(rows.filter((row) => row.kind === "YOUTUBE").map((row) => row.ref))];
    const videoIds = await mediaAssetRepository.embedIdsByRefs(orgId, videoRefs, db);
    for (const ref of videoRefs) {
        if (videoIds.has(ref)) continue;
        const created = await mediaAssetRepository.createEmbed({ orgId, ref }, db);
        videoIds.set(ref, created.id);
    }
    return rows.map((row) => ({
        ...row,
        assetId: (row.kind === "YOUTUBE" ? videoIds : imageIds).get(row.ref) ?? null,
    }));
}

export function mediaWrite(media: ProductMediaInput[]) {
  return {
    thumbnail: coverOf(media).ref,
    rows: media.map((item, index) => ({
      kind: item.kind,
      ref: item.ref,
      description: blankToNull(item.description),
      isThumbnail: item.isThumbnail,
      slot: item.kind === "IMAGE" ? blankToNull(item.slot) : null,
      position: index,
    })),
  };
}

// ✅ Efficient select - only fetch needed fields
const PRODUCT_LIST_SELECT = {
    id: true,
    orgId: true,
    categoryId: true,
    name: true,
    sku: true,
    price: true,
    currency: true,
    // Admin truth: every row, active or not (R9) — summed into `stock` on the way out.
    stockLocations: { select: { quantity: true } },
    lowStockThreshold: true,
    flags: true,
    thumbnail: true,
    weight: true,
    createdAt: true,
    // The org sees its own archived products and can restore them, so this travels
    // on the org-facing shape (ADR-0029). The buyer-facing DTO never carries it —
    // a buyer is never handed an archived product at all.
    archivedAt: true,
    category: {
        select: { id: true, name: true },
    },
    org: {
        select: { id: true, name: true, code: true },
    },
} satisfies Prisma.ProductSelect;

/** Gallery order is the only order media is ever read in (R16). The asset join is what a VIDEO row's poster and state come from. */
const MEDIA_SELECT = {
    select: { id: true, kind: true, ref: true, description: true, isThumbnail: true, slot: true, asset: PRODUCT_MEDIA_ASSET_SELECT },
    orderBy: { position: "asc" },
} satisfies Prisma.Product$mediaArgs;

const PRODUCT_DETAILS_SELECT = {
    ...PRODUCT_LIST_SELECT,
    slug: true,
    description: true,
    tags: true,
    media: MEDIA_SELECT,
    sizes: true,
    colors: true,
    stockLocations: {
        select: {
            orgAddressId: true,
            quantity: true,
            orgAddress: { select: { name: true } },
        },
    },
} satisfies Prisma.ProductSelect;

/** Sum the join rows into the `stock` total every consumer already reads (D3). */
function withStockTotal<P extends { stockLocations: Array<{ quantity: number }> }>(product: P) {
    const { stockLocations, ...rest } = product;
    return { ...rest, stock: stockLocations.reduce((sum, row) => sum + row.quantity, 0) };
}

export class AdminProductsRepository {
    /**
     * Get paginated list of products with filters
     */
    // server/repositories/admin/productRepository.ts

    async getProducts(filters: ProductFilters) {
        const {
            page = 1,
            limit = 20,
            shelf = "available",
            search,
            categoryId,
            orgId,
            flags,
            lowStock,
            outOfStock,
            productIds,
            sortBy,
            sortOrder,
        } = filters;

        // Build where clause. Stock is an aggregate since stock-locations (D3), so
        // stock-dependent filters and sorts happen in memory below — measured fine at
        // this catalogue size (tens of rows), which was D3's open question.
        const where: Prisma.ProductWhereInput = {
            ...shelfFilter(shelf),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { sku: { contains: search, mode: "insensitive" } },
                ],
            }),
            ...(categoryId && { categoryId }),
            ...(orgId && { orgId }),
            ...(flags && { flags: { hasSome: flags } }),
            // An empty list is a real answer — a caller whose filter matched nothing
            // wants no rows, not every row — so this tests undefined, not truthiness.
            ...(productIds !== undefined && { id: { in: productIds } }),
        };

        const orderBy: Prisma.ProductOrderByWithRelationInput =
            sortBy === "name"
                ? { name: sortOrder || "asc" }
                : sortBy === "price"
                    ? { price: sortOrder || "desc" }
                    : { createdAt: "desc" };

        // Any stock-dependent shape: fetch the (small) matching set, aggregate, then
        // filter/sort/slice in memory.
        if (lowStock || outOfStock || sortBy === "stock") {
            const allProducts = (await prisma.product.findMany({
                where,
                orderBy,
                select: PRODUCT_LIST_SELECT,
                // Product + stockLocations + category + org in one JOIN, not four
                // statements. (The in-memory slice below stands: stock is a sum across
                // stockLocations, so this shape cannot paginate in SQL.)
                relationLoadStrategy: "join",
            })).map(withStockTotal);

            let filteredProducts = allProducts;
            if (outOfStock) filteredProducts = filteredProducts.filter((p) => p.stock === 0);
            if (lowStock) {
                filteredProducts = filteredProducts.filter(
                    (p) => p.stock <= p.lowStockThreshold && p.stock > 0
                );
            }
            if (sortBy === "stock") {
                filteredProducts = [...filteredProducts].sort((a, b) =>
                    (sortOrder || "desc") === "desc" ? b.stock - a.stock : a.stock - b.stock
                );
            }

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
                relationLoadStrategy: "join",
            }),
            prisma.product.count({ where }),
        ]);

        return {
            products: products.map(withStockTotal),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * The product already wearing this SKU in this org, so the refusal can name it.
     * SKU uniqueness is org-scoped (bulk-catalog-upload R4): the constraint is
     * (orgId, sku), and the violation surfaces as a correctable form error rather
     * than a raw P2002.
     */
    private async skuConflictError(orgId: string, sku: string | null | undefined) {
        const taken = sku
            ? await prisma.product.findUnique({
                  where: { orgId_sku: { orgId, sku } },
                  select: { name: true, archivedAt: true },
              })
            : null;
        // An archived product still holds its SKU, so the clash is with something the
        // org cannot see in its default list. Saying so is the whole mitigation
        // (ADR-0029 D8) — "already in use" would send them hunting for a product that
        // is not there.
        const message = !taken
            ? `SKU "${sku}" is already used by another product in this organisation`
            : taken.archivedAt
              ? `SKU "${sku}" is still held by "${taken.name}", which is archived. An archived product keeps its SKU so it can be restored — reuse the code by restoring and editing that product, or choose another.`
              : `SKU "${sku}" is already used by "${taken.name}"`;
        return new ConflictError(message, { field: "sku" });
    }

    /**
     * Create new product
     */
    async createProduct(data: ProductPersistInput) {
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
                if (isUniqueViolation(error, "sku")) {
                    throw await this.skuConflictError(data.orgId, data.sku);
                }
                throw error;
            }
        }
    }

    private async insertProduct(slug: string, data: ProductPersistInput) {
        // Quantities live only on the join rows since the destructive PR; zero rows
        // are dropped ("not stocked here"), and origin comes from the locations.
        const stockRows = data.stockLocations.filter((row) => row.quantity > 0);
        const media = mediaWrite(data.media);
        const mediaRows = await withAssetIds(media.rows, data.orgId);
        const product = await prisma.product.create({
            data: {
                slug,
                name: data.name,
                description: data.description || "",
                price: data.price,
                currency: data.currency || "INR",
                orgId: data.orgId,
                categoryId: data.categoryId,
                tags: data.tags || [],
                flags: data.flags || [],
                thumbnail: media.thumbnail,
                media: { create: mediaRows },
                sizes: data.sizes || [],
                colors: data.colors || [],
                sku: blankToNull(data.sku),
                lowStockThreshold: data.lowStockThreshold || 10,
                weight: data.weight,
                // Resolved on save and server-owned; the form never sends them
                // (listing-vocabulary/categories D1b, inherited-facts D2).
                productType: data.productType,
                kind: blankToNull(data.kind ?? undefined),
                familyId: data.familyId ?? null,
                facts: data.facts as never,
                measurements: data.measurements as never,
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
            relationLoadStrategy: "join",
        });
    }

    /** The copy picker's list: the org's available products, names only (copy-product D3). */
    async listCopyOptions(orgId: string) {
        return await prisma.product.findMany({
            where: { orgId, ...AVAILABLE },
            select: { id: true, name: true, sku: true },
            orderBy: { name: "asc" },
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
     * Archive a product, or restore it (ADR-0029). `archivedAt` is server-owned
     * and never arrives from a request body (Invariant 4), so it is set here from a
     * clock rather than passed through.
     *
     * The stock row lock is the point of the transaction. Archiving is a one-row
     * update that needs no transaction of its own, but the order path locks these same
     * rows when it reserves stock, and `assertNotArchived` runs behind that lock — so
     * taking it here makes a withdrawal and a checkout serialise instead of
     * interleaving. Whichever gets the lock wins, and the other sees the result.
     *
     * `guard` runs *after* the lock for the same reason: a check made in front of it
     * is a read-then-write, and whatever it was looking for can commit in the gap
     * (Invariant 6). Opening a bidding event takes this same lock, so the caller's
     * bidding check only means anything from in here.
     */
    async setArchived(
        id: string,
        archivedAt: Date | null,
        adminId: string,
        guard?: (tx: Prisma.TransactionClient) => Promise<void>
    ) {
        return await prisma.$transaction(async (tx) => {
            await productsRepository.lockStock(id, tx);
            if (guard) await guard(tx);
            const product = await tx.product.update({
                where: { id },
                data: { archivedAt },
                select: PRODUCT_DETAILS_SELECT,
            });
            // In-transaction, so the trail cannot record a withdrawal that rolled back
            // (ADR-0021). `adminId` is the org membership's user, re-read by
            // `resolveOrgScope` rather than taken from the token claim.
            await recordAdminActionIn(tx, {
                adminId,
                action: archivedAt ? "PRODUCT_ARCHIVED" : "PRODUCT_RESTORED",
                resource: "Product",
                resourceId: id,
                metadata: { name: product.name },
            });
            return product;
        });
    }

    /**
     * How many rows hold a `Restrict` foreign key on this product, per relation —
     * null when there is no such product.
     *
     * These three are the only referrers that do not cascade (ADR-0020): an order
     * line, a promotion target and a bidding event each carry money or attribution,
     * so the database refuses to orphan them. Counted here, through the product's own
     * relations in one round trip, purely so the refusal can name its reason — the
     * foreign keys remain the enforcement, and a count is not a lock.
     */
    async countDeleteBlockers(id: string) {
        const row = await prisma.product.findUnique({
            where: { id },
            select: {
                _count: {
                    select: { orderItems: true, promotionTargets: true, biddingEvents: true },
                },
            },
        });
        return row?._count ?? null;
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

        // Stock is an aggregate (D3): load the scope's products with their rows and
        // sum in memory — measured fine at this catalogue size.
        // Every figure below is about what is available (ADR-0029): an archived
        // product's stock is real but not sellable, and a low-stock alert on something
        // deliberately archived is noise. Archived is reported as its own count
        // rather than folded in, so no figure is silently ambiguous.
        // "Products" is two numbers once a product can have siblings (variants D6): twenty
        // abayas in five colours is twenty families and a hundred sellable things, and a figure
        // that does not say which it counts is the ambiguous one. The family count is reported
        // beside the sellable one rather than instead of it.
        const [totalProducts, archivedProducts, familyCount, scopedProducts] = await Promise.all([
            prisma.product.count({ where: { ...scope, ...AVAILABLE } }),
            prisma.product.count({ where: { ...scope, ...ARCHIVED } }),
            prisma.productFamily.count({
                where: { retiredAt: null, products: { some: { ...scope, ...AVAILABLE } } },
            }),
            prisma.product.findMany({
                where: { ...scope, ...AVAILABLE },
                select: {
                    price: true,
                    stockLocations: { select: { quantity: true } },
                    lowStockThreshold: true,
                    flags: true,
                },
            }),
        ]);

        const withTotals = scopedProducts.map(withStockTotal);
        const outOfStockProducts = withTotals.filter((p) => p.stock === 0).length;
        const lowStockProducts = withTotals.filter(
            (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
        ).length;

        const featuredProducts = withTotals.filter((p) =>
            p.flags.includes(ProductFlag.FEATURED)
        ).length;

        const totalInventoryValue = withTotals.reduce((sum, product) => {
            return sum + product.price * product.stock;
        }, 0);

        return {
            totalProducts,
            archivedProducts,
            familyCount,
            lowStockProducts,
            outOfStockProducts,
            featuredProducts,
            totalInventoryValue,
        };
    }

    async updateProduct(id: string, data: ProductPersistInput) {
        // Fields are enumerated, not spread: `data` originates from a request body,
        // so spreading it would let any writable column through. `slug` is absent
        // deliberately — it is generated once at creation and then frozen, because
        // changing it would 404 every existing link to the product.
        // An admin edit is a full replace, so delete-then-create is the honest
        // semantics — corrections included (R9).
        const stockRows = data.stockLocations.filter((row) => row.quantity > 0);
        // The gallery is replaced wholesale in the same transaction as `thumbnail`, so
        // no ordering, insertion, or removal can commit having left the cache pointing
        // at a row that is gone (D4b). Removing the cover without designating another
        // never reaches here — the payload fails validation first, which is what A12's
        // refusal is (D4c).
        const media = mediaWrite(data.media);
        let product;
        try {
            product = await prisma.$transaction(async (tx) => {
            await tx.productStock.deleteMany({ where: { productId: id } });
            await tx.productMedia.deleteMany({ where: { productId: id } });
            const mediaRows = await withAssetIds(media.rows, data.orgId, tx);
            return tx.product.update({
                where: { id },
                data: {
                    name: data.name,
                    description: data.description,
                    price: data.price,
                    currency: data.currency,
                    orgId: data.orgId,
                    categoryId: data.categoryId,
                    tags: data.tags,
                    flags: data.flags,
                    thumbnail: media.thumbnail,
                    media: { create: mediaRows },
                    sizes: data.sizes,
                    colors: data.colors,
                    sku: blankToNull(data.sku),
                    lowStockThreshold: data.lowStockThreshold,
                    weight: data.weight,
                    // Symmetric with create (Invariant 4): an update that whitelists
                    // less than its create is how a field becomes unsettable.
                    productType: data.productType,
                    kind: blankToNull(data.kind ?? undefined),
                    familyId: data.familyId ?? null,
                    facts: data.facts as never,
                    measurements: data.measurements as never,
                    stockLocations: {
                        create: stockRows.map((row) => ({
                            orgAddressId: row.orgAddressId,
                            quantity: row.quantity,
                        })),
                    },
                },
            });
            });
        } catch (error) {
            if (isUniqueViolation(error, "sku")) {
                throw await this.skuConflictError(data.orgId, data.sku);
            }
            throw error;
        }
        if (!product) {
            throw new NotFoundError("Product not found");
        }
        return product;
    }


  /** The categories this org has products on sale in — what its listing defaults are keyed by. */
  async listCategoriesSoldBy(orgId: string): Promise<Array<{ id: string; name: string }>> {
    const rows = await prisma.product.findMany({
      where: { orgId, archivedAt: null },
      distinct: ["categoryId"],
      select: { category: { select: { id: true, name: true } } },
      orderBy: { category: { name: "asc" } },
    });
    return rows.map((row) => row.category);
  }
}

export const adminProductsRepository = new AdminProductsRepository();
