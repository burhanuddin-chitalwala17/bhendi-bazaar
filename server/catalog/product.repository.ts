/**
 * Admin Product Repository
 * Handles database operations for product management
 */

import { prisma } from "@server/shared/prisma";
import {
    DEFAULT_WEIGHT_KG,
    type MarketplaceFill,
    type MarketplaceFilled,
    type ProductFilters,
    type ProductFormInput,
    type ProductPersistInput,
} from "@server/catalog/admin.product.types";
import { ProductFlag } from "@server/catalog/product.flags";
import { Prisma } from "@prisma/client";
import { slugCandidates, isUniqueViolation } from "@server/shared/slug";
import { blankToNull } from "@server/shared/nullable";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { ARCHIVED, AVAILABLE, shelfFilter } from "@server/catalog/product.visibility";
import { PRODUCT_MEDIA_ASSET_SELECT } from "@server/catalog/product.read.repository";
import { stockRepository } from "@server/catalog/stock.repository";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { pushStockSpec } from "@server/shared/jobs/push-stock.job";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { coverOf, type MediaKind, type ProductMediaInput } from "@server/catalog/media";
import { mediaAssetRepository, type MediaDb } from "@server/catalog/media-asset.repository";
import { VERSION_FIELD, versionConflictMessage } from "@server/catalog/product-edit";

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

/** The person saving: the version moves and they are named on the product (product-form D6, D7). */
export interface ProductEditor {
    userId: string;
    /** A Bhendi Bazaar team save, which marks the product until the shop next saves it. */
    team: boolean;
}

/**
 * MRP, barcode and key features as the form sent them (channel-listings D7), the same on create and
 * update (Invariant 4). Absent leaves the stored value: a client that never knew the field cannot clear it.
 */
function listingIdentity(data: Pick<ProductPersistInput, "mrp" | "barcode" | "keyFeatures">) {
    return {
        ...(data.mrp === undefined ? {} : { mrpPaise: data.mrp }),
        ...(data.barcode === undefined ? {} : { barcode: blankToNull(data.barcode) }),
        ...(data.keyFeatures === undefined ? {} : { keyFeatures: data.keyFeatures }),
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
    // The team's mark on a list row, until the shop next saves (product-form D13).
    teamEditedAt: true,
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
    // The listing vocabulary, including **which level answered each fact**: a value filled in
    // from a brand is convenient until it is wrong on one product and nothing on screen says
    // where it came from (inherited-facts R3).
    productType: true,
    kind: true,
    familyId: true,
    brandId: true,
    facts: true,
    measurements: true,
    mrpPaise: true,
    barcode: true,
    keyFeatures: true,
    media: MEDIA_SELECT,
    // Who saved last, so the form can say so and refuse a save over it (product-form D6, D7).
    version: true,
    lastEditedAt: true,
    teamEditedAt: true,
    lastEditedBy: { select: { name: true } },
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

const asEntries = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** An answer nobody gave: absent, or blank. */
const isEmptyEntry = (entry: unknown) => {
    const value = (entry as { value?: unknown } | undefined)?.value;
    return value === undefined || value === null || String(value).trim() === "";
};

export class AdminProductsRepository {
    /**
     * Get paginated list of products with filters
     */
    // the write-side product repository

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
              : `Your product '${taken.name}' already uses this code.`;
        return new ConflictError(message, { field: "sku" });
    }

    /**
     * Create new product
     */
    async createProduct(data: ProductPersistInput, editor?: ProductEditor) {
        // The slug is derived from the name, never taken from input, and settled by
        // the unique constraint rather than a prior availability query — checking
        // first is a race the database already arbitrates.
        const candidates = slugCandidates(data.name);
        for (let attempt = 0; ; attempt++) {
            const slug = candidates.next().value as string;
            try {
                return await this.insertProduct(slug, data, editor);
            } catch (error) {
                if (isUniqueViolation(error, "slug") && attempt < 25) continue;
                if (isUniqueViolation(error, "sku")) {
                    throw await this.skuConflictError(data.orgId, data.sku);
                }
                throw error;
            }
        }
    }

    private async insertProduct(slug: string, data: ProductPersistInput, editor?: ProductEditor) {
        return await prisma.$transaction(async (tx) => await this.insertProductIn(tx, slug, data, null, editor));
    }

    /**
     * Create a product inside a caller's transaction (product-merge D5). The slug is chosen free
     * first: a duplicate aborts a Postgres transaction, so the retry `createProduct` does cannot
     * happen in here, and a rare race fails the whole save as retryable instead.
     */
    async createInTransaction(tx: Prisma.TransactionClient, data: ProductPersistInput, archivedAt: Date | null) {
        const candidates = slugCandidates(data.name);
        const base = candidates.next().value as string;
        const taken = new Set(
            (await tx.product.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((row) => row.slug),
        );
        let slug = base;
        while (taken.has(slug)) slug = candidates.next().value as string;
        try {
            return await this.insertProductIn(tx, slug, data, archivedAt);
        } catch (error) {
            if (isUniqueViolation(error, "sku")) throw await this.skuConflictError(data.orgId, data.sku);
            if (isUniqueViolation(error, "slug")) throw new ConflictError("Couldn't save. Nothing was changed. Try again.");
            throw error;
        }
    }

    /** The two fields a merge may take from a marketplace listing (product-merge Q6, Q13). */
    async updateNamedFieldsIn(
        tx: Prisma.TransactionClient,
        id: string,
        orgId: string,
        fields: { name?: string; description?: string },
    ): Promise<boolean> {
        if (fields.name === undefined && fields.description === undefined) return true;
        const result = await tx.product.updateMany({
            where: { id, orgId },
            data: {
                ...(fields.name !== undefined ? { name: fields.name } : {}),
                ...(fields.description !== undefined ? { description: fields.description } : {}),
            },
        });
        return result.count === 1;
    }

    /**
     * Put copied photos on a product (product-merge D6): appended after what it has, or replacing
     * its images (videos stay). The first image becomes the main photo when replacing.
     */
    async setImages(productId: string, orgId: string, refs: string[], mode: "append" | "replace") {
        if (refs.length === 0) return;
        await prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({ where: { id: productId, orgId }, select: { id: true } });
            if (!product) return;
            if (mode === "replace") await tx.productMedia.deleteMany({ where: { productId, kind: "IMAGE" } });
            const existing = await tx.productMedia.findMany({
                where: { productId },
                select: { ref: true, position: true },
                orderBy: { position: "asc" },
            });
            const have = new Set(existing.map((row) => row.ref));
            const fresh = refs.filter((ref) => !have.has(ref));
            if (fresh.length === 0) return;
            const start = existing.length === 0 ? 0 : existing[existing.length - 1].position + 1;
            const rows = await withAssetIds(
                fresh.map((ref) => ({ kind: "IMAGE" as const, ref })),
                orgId,
                tx,
            );
            const makesCover = mode === "replace" || existing.length === 0;
            if (makesCover) await tx.productMedia.updateMany({ where: { productId }, data: { isThumbnail: false } });
            await tx.productMedia.createMany({
                data: rows.map((row, index) => ({
                    productId,
                    kind: row.kind,
                    ref: row.ref,
                    assetId: row.assetId,
                    position: start + index,
                    isThumbnail: makesCover && index === 0,
                })),
            });
            if (makesCover) await tx.product.update({ where: { id: productId }, data: { thumbnail: rows[0].ref } });
        });
    }

    /**
     * A marketplace listing's answers onto a product (marketplace-facts D7): under the row's lock,
     * only what is still empty, so an edit made meanwhile wins. Returns what it filled.
     */
    async fillFromMarketplace(orgId: string, id: string, fill: MarketplaceFill, within?: Prisma.TransactionClient): Promise<MarketplaceFilled | null> {
        const run = async (tx: Prisma.TransactionClient): Promise<MarketplaceFilled | null> => {
            const [row] = await tx.$queryRaw<Array<{ facts: unknown; measurements: unknown; weight: number | null; mrpPaise: number | null; brandId: string | null }>>`
                SELECT facts, measurements, weight, "mrpPaise", "brandId" FROM "Product" WHERE id = ${id} AND "orgId" = ${orgId} FOR UPDATE`;
            if (!row) return null;
            const facts = { ...asEntries(row.facts) };
            const measurements = { ...asEntries(row.measurements) };
            const filled: MarketplaceFilled = { facts: [], measurements: [], weight: false, mrp: false, brand: false };
            for (const [key, entry] of Object.entries(fill.facts)) {
                if (isEmptyEntry(facts[key])) (facts[key] = entry), filled.facts.push(key);
            }
            for (const [key, entry] of Object.entries(fill.measurements)) {
                if (isEmptyEntry(measurements[key])) (measurements[key] = entry), filled.measurements.push(key);
            }
            // Every product starts at the default weight, so it counts as unset (marketplace-facts Q28).
            filled.weight = fill.weightKg !== null && (row.weight === null || row.weight === DEFAULT_WEIGHT_KG);
            filled.mrp = fill.mrpPaise !== null && row.mrpPaise === null;
            filled.brand = fill.brandId !== null && row.brandId === null;
            if (!filled.facts.length && !filled.measurements.length && !filled.weight && !filled.mrp && !filled.brand) return filled;
            await tx.product.update({
                where: { id },
                data: {
                    ...(filled.facts.length ? { facts: facts as Prisma.InputJsonValue } : {}),
                    ...(filled.measurements.length ? { measurements: measurements as Prisma.InputJsonValue } : {}),
                    ...(filled.weight ? { weight: fill.weightKg } : {}),
                    ...(filled.mrp ? { mrpPaise: fill.mrpPaise } : {}),
                    ...(filled.brand ? { brandId: fill.brandId } : {}),
                },
                select: { id: true },
            });
            return filled;
        };
        // In a settle's transaction, the facts are saved with the product (marketplace-facts Q35).
        return within ? await run(within) : await prisma.$transaction(run);
    }

    /**
     * One answer set from the marketplace card (marketplace-facts D8): chosen, changed or reset; null
     * clears it. An answer is refused when the shop answered meanwhile, naming what it answered.
     */
    async setMarketplaceAnswer(
        orgId: string,
        id: string,
        column: "facts" | "measurements",
        key: string,
        entry: Record<string, unknown> | null,
        onlyIfEmpty: boolean,
    ): Promise<{ saved: true } | { saved: false; current: unknown } | null> {
        return await prisma.$transaction(async (tx) => {
            const [row] = column === "facts"
                ? await tx.$queryRaw<Array<{ value: unknown }>>`SELECT facts AS value FROM "Product" WHERE id = ${id} AND "orgId" = ${orgId} FOR UPDATE`
                : await tx.$queryRaw<Array<{ value: unknown }>>`SELECT measurements AS value FROM "Product" WHERE id = ${id} AND "orgId" = ${orgId} FOR UPDATE`;
            if (!row) return null;
            const entries = { ...asEntries(row.value) };
            if (onlyIfEmpty && !isEmptyEntry(entries[key])) return { saved: false, current: (entries[key] as { value?: unknown }).value };
            if (entry) entries[key] = entry;
            else delete entries[key];
            await tx.product.update({ where: { id }, data: { [column]: entries as Prisma.InputJsonValue }, select: { id: true } });
            return { saved: true };
        });
    }

    /**
     * An existing product joins a family made from its marketplace listings (family-merge D3):
     * only while it is in no family, or in the one the owner chose to move it from. The count is the verdict.
     */
    async setFamilyIn(tx: Prisma.TransactionClient, orgId: string, id: string, familyId: string, fromFamilyId: string | null): Promise<boolean> {
        const result = await tx.product.updateMany({ where: { id, orgId, familyId: fromFamilyId }, data: { familyId } });
        return result.count === 1;
    }

    /** The category a marketplace's type led the shop to choose; the product's type follows it (marketplace-facts Q25, Q27). */
    async setCategoryFromMarketplace(orgId: string, id: string, categoryId: string, productType: string | null): Promise<boolean> {
        const result = await prisma.product.updateMany({ where: { id, orgId }, data: { categoryId, productType, kind: null } });
        return result.count === 1;
    }

    /** A family's members, archived included, for adding to it (family-merge Q20): what each answers, to tell new ones apart. */
    async familyMembers(orgId: string, familyId: string) {
        return await prisma.product.findMany({
            where: { orgId, familyId },
            select: { id: true, name: true, sku: true, categoryId: true, productType: true, facts: true, measurements: true },
            orderBy: { name: "asc" },
        });
    }

    /** What filling from a marketplace needs of a product, and what its card shows (marketplace-facts D5, D6). */
    async marketplaceFacts(orgId: string, id: string) {
        return await prisma.product.findFirst({
            where: { id, orgId },
            select: { id: true, categoryId: true, productType: true, kind: true, brandId: true, facts: true, measurements: true, weight: true, mrpPaise: true },
        });
    }

    /** What the Settle page shows of a product being matched (product-merge R4). */
    async settleFacts(orgId: string, id: string) {
        return await prisma.product.findFirst({
            where: { id, orgId },
            select: {
                id: true,
                name: true,
                sku: true,
                description: true,
                price: true,
                thumbnail: true,
                archivedAt: true,
                categoryId: true,
                media: { where: { kind: "IMAGE" }, select: { ref: true }, orderBy: { position: "asc" } },
                stockLocations: { select: { orgAddressId: true, quantity: true } },
            },
        });
    }

    private async insertProductIn(
        tx: Prisma.TransactionClient,
        slug: string,
        data: ProductPersistInput,
        archivedAt: Date | null,
        editor?: ProductEditor,
    ) {
        const media = mediaWrite(data.media);
        const now = new Date();
        {
        const mediaRows = await withAssetIds(media.rows, data.orgId, tx);
        const product = await tx.product.create({
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
                sku: blankToNull(data.sku),
                ...listingIdentity(data),
                lowStockThreshold: data.lowStockThreshold || 10,
                weight: data.weight,
                // Resolved on save and server-owned; the form never sends them
                // (listing-vocabulary/categories D1b, inherited-facts D2).
                productType: data.productType,
                kind: blankToNull(data.kind ?? undefined),
                familyId: data.familyId ?? null,
                brandId: data.brandId ?? null,
                facts: data.facts as never,
                measurements: data.measurements as never,
                archivedAt,
                // A team create marks the product as the team's from its first save (product-form D11).
                ...(editor ? { lastEditedById: editor.userId, lastEditedAt: now, teamEditedAt: editor.team ? now : null } : {}),
            },
            include: {
                category: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        // Quantities live only on the join rows (stock-locations D3); a new product has seen
        // nothing, so every row is a creation and zero rows are dropped ("not stocked here").
        await stockRepository.adjust(product.id, data.stockLocations, tx);
        return product;
        }
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
            await stockRepository.lockAll(id, tx);
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
            // Archived sells nowhere, restored sells again: its marketplaces hear either way (inventory-sync Q6).
            await enqueue(tx, pushStockSpec, { productId: id, soldOut: archivedAt !== null });
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
                    select: { orderItems: true, promotionTargets: true, biddingEvents: true, channelListings: true },
                },
            },
        });
        return row?._count ?? null;
    }

    /**
     * Products carrying the team's mark (product-form D13, Q23); the id too when there is just one.
     * Available only: a product the shop archived since is one it has already acted on.
     */
    async teamEditedSummary(orgId: string): Promise<{ count: number; productId: string | null }> {
        const where = { orgId, teamEditedAt: { not: null }, ...AVAILABLE } satisfies Prisma.ProductWhereInput;
        const [count, first] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findFirst({ where, select: { id: true } }),
        ]);
        return { count, productId: count === 1 ? (first?.id ?? null) : null };
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

    async updateProduct(id: string, data: ProductPersistInput & { seenVersion: number }, editor: ProductEditor) {
        // Fields are enumerated, not spread: `data` originates from a request body,
        // so spreading it would let any writable column through. `slug` is absent
        // deliberately — it is generated once at creation and then frozen, because
        // changing it would 404 every existing link to the product.
        // Stock is NOT replaced wholesale any more: each row is compared against what the
        // editor saw, so a sale that landed while the form was open is refused, not undone.
        // The gallery is replaced wholesale in the same transaction as `thumbnail`, so
        // no ordering, insertion, or removal can commit having left the cache pointing
        // at a row that is gone (D4b). Removing the cover without designating another
        // never reaches here — the payload fails validation first, which is what A12's
        // refusal is (D4c).
        const media = mediaWrite(data.media);
        let product;
        try {
            product = await prisma.$transaction(async (tx) => {
            // The version compare-and-set comes first, so a stale form moves no stock, media or field
            // (product-form D6). A shop save clears the team's mark; a team save sets it (D7).
            const now = new Date();
            const claimed = await tx.product.updateMany({
                where: { id, orgId: data.orgId, version: data.seenVersion },
                data: {
                    version: { increment: 1 },
                    lastEditedById: editor.userId,
                    lastEditedAt: now,
                    teamEditedAt: editor.team ? now : null,
                },
            });
            if (claimed.count === 0) throw await this.versionConflict(tx, id, data.orgId, editor.userId);
            await stockRepository.adjust(id, data.stockLocations, tx);
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
                    sku: blankToNull(data.sku),
                    ...listingIdentity(data),
                    lowStockThreshold: data.lowStockThreshold,
                    weight: data.weight,
                    // Symmetric with create (Invariant 4): an update that whitelists
                    // less than its create is how a field becomes unsettable.
                    productType: data.productType,
                    kind: blankToNull(data.kind ?? undefined),
                    familyId: data.familyId ?? null,
                    brandId: data.brandId ?? null,
                    facts: data.facts as never,
                    measurements: data.measurements as never,
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


  /** Why a save from a seen version was refused: who saved since, and when (product-form D7). */
  private async versionConflict(tx: Prisma.TransactionClient, id: string, orgId: string, viewerId: string) {
    const current = await tx.product.findFirst({
      where: { id, orgId },
      select: { lastEditedById: true, lastEditedAt: true, teamEditedAt: true, lastEditedBy: { select: { name: true } } },
    });
    if (!current) return new NotFoundError("Product not found");
    return new ConflictError(
      versionConflictMessage({ ...current, lastEditedByName: current.lastEditedBy?.name ?? null }, viewerId),
      { field: VERSION_FIELD },
    );
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

  /** Which of these SKUs this org already holds. Archived included: an archived product keeps its SKU (ADR-0029). */
  async listSkusTaken(orgId: string, skus: string[]) {
    return await prisma.product.findMany({
      where: { orgId, sku: { in: skus } },
      select: { id: true, sku: true, name: true, archivedAt: true },
    });
  }

  /** A count under a predicate the caller owns — the fact correction's preview (inherited-facts R6). */
  async countWhere(where: Prisma.ProductWhereInput): Promise<number> {
    return await prisma.product.count({ where });
  }

  /** The facts of every product under a predicate — the rows a fact correction rewrites. */
  async listFactsWhere(where: Prisma.ProductWhereInput) {
    return await prisma.product.findMany({ where, select: { id: true, facts: true } });
  }

  /** Writes each product's facts whole, all-or-nothing: `updateMany` cannot merge into a JSON path. */
  async replaceFacts(rows: Array<{ id: string; facts: Record<string, unknown> }>): Promise<void> {
    await prisma.$transaction(
      rows.map(({ id, facts }) => prisma.product.update({ where: { id }, data: { facts: facts as never } })),
    );
  }

  /**
   * Every product of a shop that has a SKU, archived included (ADR-0029): what a marketplace listing
   * can link to by SKU (channel-import D7). A shop's catalogue, not the platform's.
   */
  async listWithSku(orgId: string) {
    return await prisma.product.findMany({
      where: { orgId, sku: { not: null } },
      select: { id: true, sku: true, name: true, archivedAt: true },
    });
  }

  /** Every product of a shop by name, archived included: what a listing may be matched to (product-merge D3). */
  async listForMatching(orgId: string) {
    return await prisma.product.findMany({
      where: { orgId },
      select: { id: true, name: true, sku: true, price: true, thumbnail: true, archivedAt: true },
      orderBy: { name: "asc" },
    });
  }

  /** One product as a marketplace listing is compared against (channel-import Q17). */
  async compareFacts(orgId: string, id: string) {
    return await prisma.product.findFirst({
      where: { id, orgId },
      select: { id: true, name: true, sku: true, price: true, thumbnail: true, archivedAt: true, stockLocations: { select: { quantity: true } } },
    });
  }

  /** The live products holding these SKUs: the rows a bulk import updates rather than creates. */
  async listLiveSkus(orgId: string, skus: string[]) {
    return await prisma.product.findMany({
      where: { orgId, sku: { in: skus }, archivedAt: null },
      select: { id: true, sku: true },
    });
  }

  /** Every slug, archived included (ADR-0029): an archived product keeps its slug so a restore finds its URL free. */
  async listAllSlugs(): Promise<Array<{ slug: string }>> {
    return await prisma.product.findMany({ select: { slug: true } });
  }

  /**
   * A bulk import's rows, all-or-nothing in one transaction. The uploader is the editor of every
   * row, as a form save would make them (own-store/bulk-sheet D10): an update moves the version, so
   * a form open on that product is refused on save and rebases.
   */
  async importBulk(
    products: Prisma.ProductCreateManyInput[],
    updates: Prisma.ProductCreateManyInput[],
    media: Prisma.ProductMediaCreateManyInput[],
    stock: Prisma.ProductStockCreateManyInput[],
    editor?: ProductEditor,
  ): Promise<void> {
    const now = new Date();
    const edited = editor ? { lastEditedById: editor.userId, lastEditedAt: now, teamEditedAt: editor.team ? now : null } : {};
    await prisma.$transaction(async (tx) => {
      if (products.length) await tx.product.createMany({ data: products.map((row) => ({ ...row, ...edited })) });

      // An update is a full replace, the same semantics the admin form's edit has: the sheet
      // row is the product now. `slug` is absent from the data — it is the product's own, and
      // changing it would break every link to it.
      for (const row of updates) {
        const { id, slug: _slug, version: _version, ...data } = row;
        await tx.product.update({ where: { id }, data: { ...data, ...edited, version: { increment: 1 } } });
      }

      // The gallery and the stock are replaced wholesale for an updated product, in the same
      // transaction, so nothing can commit with `thumbnail` pointing at a row that is gone.
      const ids = updates.map((row) => row.id as string);
      if (ids.length) await tx.productMedia.deleteMany({ where: { productId: { in: ids } } });
      if (media.length) await tx.productMedia.createMany({ data: media });
      await stockRepository.setForImport(ids, stock, tx);
    });
  }

  /** Gallery rows whose image predates the asset record — the media backfill's input (media-library D3). */
  async listUnlinkedMedia() {
    return await prisma.productMedia.findMany({
      where: { assetId: null },
      select: { id: true, kind: true, ref: true, product: { select: { orgId: true } } },
    });
  }

  /** A sample of unlinked, non-embed gallery refs: enough to tell which store they belong to. */
  async sampleUnlinkedMediaRefs(take: number) {
    return await prisma.productMedia.findMany({
      where: { assetId: null, kind: { not: "YOUTUBE" } },
      select: { ref: true },
      take,
    });
  }

  async linkMediaAsset(id: string, assetId: string): Promise<void> {
    await prisma.productMedia.update({ where: { id }, data: { assetId } });
  }
}

export const adminProductsRepository = new AdminProductsRepository();
