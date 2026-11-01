/**
 * Bulk product creation for one org (bulk-catalog-upload).
 *
 * Validation answers "would this sheet import cleanly?" without writing anything;
 * creation is one transaction of createMany per table — 3 statements, not 300
 * (D5), and therefore all-or-nothing by construction (R3).
 */
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { productFamilyService } from "@server/listing/product-family.service";
import {
  loadVocabulary,
  resolveRowVocabulary,
  type VocabularyContext,
} from "./bulk-vocabulary";
import { categoryMatcher } from "./sheet-tabs";
import { normaliseWord, notInListMessage } from "./word-match";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { slugify } from "@server/shared/slug";
import { isUniqueViolation } from "@server/shared/constraint";
import { rupeesToPaise } from "@server/shared/money";
import { ConflictError, DomainError } from "@server/shared/domain-error";
import { matchImage, imageMatchMessage } from "@server/catalog/bulk/image-match";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { adminProductsRepository } from "@server/catalog/product.repository";
import { commercialTermsService } from "@server/catalog/commercial-terms.service";
import { promotionService } from "@server/promotions/promotion.service";
import {
  BULK_MAX_ROWS,
  type BulkProductRow,
  type BulkProductCreateRow,
  type RowError,
} from "@server/catalog/bulk/bulk.types";

export interface RowWithNumber<T> {
  rowNumber: number;
  /** Two tabs share row numbers, so a row is identified by its index, never its number. */
  tab?: string;
  row: T;
}

/**
 * Everything that needs the database: categories exist, stock columns name the
 * org's real locations, SKUs are free (in the sheet and in this org), image
 * filenames were actually provided, covers point at their own images.
 */
/**
 * What an upload will do, so a person sees it before confirming rather than afterwards.
 *
 * A row whose SKU matches a live product of this org **updates** it; everything else creates.
 * The counts matter because the two are not equally recoverable: a wrong create leaves a
 * product to archive, and a wrong update has overwritten something.
 */
export interface BulkPlan {
  errors: RowError[];
  /** Row index (not number: tabs share numbers) → the product it will replace. Absent creates. */
  updates: Map<number, string>;
  creates: number;
}

export async function validateProductRows(
  orgId: string,
  rows: RowWithNumber<BulkProductRow>[],
  /** Relative paths of the uploaded files — `a/b.jpg` from a folder, `b.jpg` flat. */
  providedPaths: string[]
): Promise<RowError[]> {
  const errors: RowError[] = [];
  if (rows.length > BULK_MAX_ROWS) {
    errors.push({
      row: 0,
      field: "sheet",
      message: `Your sheet has ${rows.length} rows. Upload ${BULK_MAX_ROWS} or fewer at a time — split it into two sheets.`,
    });
    return errors;
  }

  const [categories, tree, locations, terms] = await Promise.all([
    categoryRepository.list(),
    categoryRepository.listTree(),
    orgAddressRepository.listByOrg(orgId),
    commercialTermsService.find(orgId),
  ]);
  const matchCategory = categoryMatcher(categories);
  // Every word the dropdowns offered is checked here too, whatever the sheet let through (R5).
  const vocabulary = await loadVocabulary(rows.map(({ row }) => row), tree, orgId);
  const locationByName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l]));
  const provided = providedPaths.map((path) => path.trim());

  const skus = rows.flatMap(({ row, rowNumber }) => (row.sku ? [{ sku: row.sku, rowNumber }] : []));
  const taken = skus.length
    ? // Archived products are included deliberately: they still hold their SKU, so a row
      // claiming one is refused rather than silently restoring it (ADR-0029, product-archive Q1).
      await adminProductsRepository.listSkusTaken(orgId, skus.map((s) => s.sku))
    : [];
  const archivedSkus = new Set(
    taken.filter((p) => p.archivedAt).map((p) => p.sku as string)
  );
  // A row updating a product may keep its running sale price, however deep (the form's rule).
  const liveIdBySku = new Map(taken.filter((p) => !p.archivedAt).map((p) => [p.sku as string, p.id]));
  const seenInSheet = new Map<string, SheetRowRef>();

  for (const { row, rowNumber, tab } of rows) {
    const rowErrors: RowError[] = [];
    const category = matchCategory.match(row.categorySlug);
    if (!category) {
      rowErrors.push({
        row: rowNumber,
        field: "category",
        message: notInListMessage("Category", row.categorySlug, matchCategory.closest(row.categorySlug)),
      });
    }
    rowErrors.push(...resolveRowVocabulary(row, rowNumber, category?.id, vocabulary).errors);

    for (const locationName of Object.keys(row.stock)) {
      if (!locationByName.has(locationName.trim().toLowerCase())) {
        rowErrors.push({
          row: rowNumber,
          field: `stock:${locationName}`,
          message: `"${locationName}" is not one of this organisation's pickup locations. Create it on the Locations page first.`,
        });
      }
    }

    if (row.sku) {
      // A SKU already in use is not a conflict any more — it is how a sheet says "update this
      // one" (bulk-sheet). The one exception stays an error: an archived product still holds
      // its SKU, and an import must never silently restore it (ADR-0029, product-archive Q1).
      if (archivedSkus.has(row.sku)) {
        rowErrors.push({
          row: rowNumber,
          field: "sku",
          message: `SKU ${row.sku} belongs to an archived product. Restore it, or use another code.`,
        });
      }
      const first = seenInSheet.get(row.sku);
      if (first !== undefined) {
        rowErrors.push({
          row: rowNumber,
          field: "sku",
          message: `SKU ${row.sku} is used twice — rows ${twoRows(first, { rowNumber, tab })}`,
        });
      } else {
        seenInSheet.set(row.sku, { rowNumber, tab });
      }
    }

    for (const reference of row.images) {
      const match = matchImage(reference, provided);
      if ("kind" in match) {
        rowErrors.push({
          row: rowNumber,
          field: "images",
          message: imageMatchMessage(reference, match),
        });
      }
    }
    // The product form's refusal, as a row error (offers-hardening Q7).
    if (terms && row.salePrice !== undefined && row.salePrice > 0 && row.salePrice < row.price) {
      const breach = await promotionService.saleBreach({
        productId: row.sku ? liveIdBySku.get(row.sku) : undefined,
        pricePaise: rupeesToPaise(row.price),
        salePricePaise: rupeesToPaise(row.salePrice),
        ceilingBps: terms.maxDiscountBps,
      });
      if (breach) rowErrors.push({ row: rowNumber, field: "salePrice", message: breach });
    }
    if (row.cover && !row.images.includes(row.cover)) {
      rowErrors.push({
        row: rowNumber,
        field: "cover",
        message: `Cover "${row.cover}" is not one of the row's images.`,
      });
    }
    // Two tabs share row numbers, so every problem carries the tab it is on.
    errors.push(...onTab(rowErrors, tab));
  }

  return errors;
}

type SheetRowRef = Pick<RowWithNumber<unknown>, "rowNumber" | "tab">;

/** "5 and 9", or "5 (Abaya) and 5 (Attar)" when the two rows are on different tabs. */
function twoRows(first: SheetRowRef, second: SheetRowRef): string {
  if (first.tab === second.tab) return `${first.rowNumber} and ${second.rowNumber}`;
  const named = (ref: SheetRowRef) => (ref.tab ? `${ref.rowNumber} (${ref.tab})` : `${ref.rowNumber}`);
  return `${named(first)} and ${named(second)}`;
}

export function onTab(errors: readonly RowError[], tab: string | undefined): RowError[] {
  return tab ? errors.map((error) => ({ ...error, tab })) : [...errors];
}

/**
 * Which rows update and which create, by the same rule validation uses: a SKU already held by a
 * live product of this org names that product.
 *
 * Read separately from validation rather than threaded through it, because the two answer
 * different questions and a caller may want either — and the read is one indexed query on a
 * unique pair.
 */
export async function planProductRows(
  orgId: string,
  rows: RowWithNumber<BulkProductRow>[]
): Promise<{ updates: Map<number, string>; creates: number }> {
  const skus = rows.map(({ row }) => row.sku).filter((sku): sku is string => !!sku);
  const updates = new Map<number, string>();
  if (skus.length === 0) return { updates, creates: rows.length };

  // Archived products are excluded: they hold their SKU but an import must not restore one,
  // which validation refuses separately with a message naming the product.
  const existing = await adminProductsRepository.listLiveSkus(orgId, skus);
  const bySku = new Map(existing.map((product) => [product.sku as string, product.id]));

  rows.forEach(({ row }, index) => {
    const id = row.sku ? bySku.get(row.sku) : undefined;
    if (id) updates.set(index, id);
  });
  return { updates, creates: rows.length - updates.size };
}

/** One row's resolved vocabulary, as the columns the product row carries. */
function vocabularyFor(
  row: BulkProductCreateRow,
  index: number,
  rows: RowWithNumber<BulkProductCreateRow>[],
  categoryBySlug: Map<string, string>,
  vocabulary: VocabularyContext,
) {
  const { resolved } = resolveRowVocabulary(
    row,
    rows[index].rowNumber,
    categoryBySlug.get(row.categorySlug),
    vocabulary,
  );
  return {
    productType: resolved.productType,
    kind: resolved.kind,
    // No Brand column (an old sheet, a CSV) leaves an updated product's brand as it was.
    ...(row.brandName !== undefined ? { brandId: resolved.brandId } : {}),
    facts: resolved.facts as Prisma.InputJsonValue,
    measurements: resolved.measurements as Prisma.InputJsonValue,
  };
}

/**
 * Families named in the sheet, made once each.
 *
 * A name that already exists is reused rather than duplicated — otherwise a second upload of
 * the same range would split a family in two and the siblings would stop sharing anything.
 */
async function resolveFamilies(
  orgId: string,
  rows: RowWithNumber<BulkProductCreateRow>[],
  categoryBySlug: Map<string, string>,
): Promise<Map<string, string>> {
  const wanted = new Map<string, string>();
  for (const { row } of rows) {
    const name = row.familyName?.trim();
    if (name) wanted.set(normaliseWord(name), row.categorySlug);
  }
  if (wanted.size === 0) return new Map();

  const existing = await productFamilyService.list(orgId, true);
  // Matched as every listed word is (D6), so "Emerald  abaya" joins "Emerald Abaya" rather than splitting it.
  const byName = new Map(existing.map((family) => [normaliseWord(family.name), family.id]));

  for (const [lowered, categorySlug] of wanted) {
    if (byName.has(lowered)) continue;
    const original = rows.find(
      ({ row }) => row.familyName && normaliseWord(row.familyName) === lowered,
    )?.row.familyName;
    const created = await productFamilyService.create(orgId, {
      name: original?.trim() ?? lowered,
      categoryId: categoryBySlug.get(categorySlug) ?? "",
    });
    byName.set(lowered, created.id);
  }
  return byName;
}

/**
 * Slugs for every row, honouring existing products and earlier rows: base name,
 * then -2, -3… One read of the existing slugs replaces a per-row availability
 * race — the unique constraint still arbitrates, and a collision in the window
 * fails the whole transaction, which all-or-nothing wants anyway.
 */
async function assignSlugs(
  rows: RowWithNumber<BulkProductCreateRow>[],
  /** Rows that update keep the slug their product already has; only creates take a new one. */
  updates: Map<number, string>,
): Promise<string[]> {
  const existing = new Set(
    // Archived included (ADR-0029): an import must not reuse a slug a restore will want back.
    (await adminProductsRepository.listAllSlugs()).map((p) => p.slug)
  );
  return rows.map(({ row }, index) => {
    // An updating row's slug is never recomputed: it is frozen at creation, because changing
    // one 404s every link to the product.
    if (updates.has(index)) return "";
    const base = slugify(row.name) || "item";
    let candidate = base;
    for (let n = 2; existing.has(candidate); n++) candidate = `${base}-${n}`;
    existing.add(candidate);
    return candidate;
  });
}

export async function createProducts(
  orgId: string,
  rows: RowWithNumber<BulkProductCreateRow>[]
): Promise<{ created: number; updated: number }> {
  const locations = await orgAddressRepository.listByOrg(orgId);
  const locationByName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l.id]));
  const [tree, categories] = await Promise.all([categoryRepository.listTree(), categoryRepository.list()]);
  // Each row's category cell, a path or a slug, to its id — matched as validation matched it (D6).
  const matchCategory = categoryMatcher(categories);
  const categoryBySlug = new Map(
    rows.map(({ row }) => [row.categorySlug, matchCategory.match(row.categorySlug)?.id ?? ""]),
  );
  // Which rows replace a product and which make one. Read before the slugs, because an
  // updating row keeps the slug it already has rather than taking a new one.
  const plan = await planProductRows(orgId, rows);
  const slugs = await assignSlugs(rows, plan.updates);

  // The vocabulary for every row at once — two queries rather than two per row.
  const vocabulary = await loadVocabulary(
    rows.map(({ row }) => row),
    tree,
    orgId,
  );
  // A family named in the sheet is made once and reused by every later row naming it, which is
  // how four colours of one abaya arrive as four rows and one family (variants R2).
  const familyIds = await resolveFamilies(orgId, rows, categoryBySlug);

  const products: Prisma.ProductCreateManyInput[] = [];
  const updates: Prisma.ProductCreateManyInput[] = [];
  const media: {
    productId: string;
    kind: "IMAGE" | "YOUTUBE";
    ref: string;
    assetId?: string | null;
    position: number;
    isThumbnail: boolean;
  }[] = [];
  const stock: { productId: string; orgAddressId: string; quantity: number }[] = [];
  const productIds: string[] = [];

  rows.forEach(({ row }, index) => {
    // An updating row writes to the product it names rather than a new one, and keeps that
    // product's slug: regenerating it would 404 every existing link (Invariant 4's reasoning
    // for freezing a slug at creation).
    const existingId = plan.updates.get(index);
    const id = existingId ?? randomUUID();
    productIds[index] = id;
    const coverName = row.cover ?? row.images[0];
    const thumbnail = row.imageUrls[coverName];

    (existingId ? updates : products).push({
      id,
      slug: slugs[index],
      name: row.name,
      description: row.description,
      price: rupeesToPaise(row.price),
      currency: "INR",
      orgId,
      categoryId: categoryBySlug.get(row.categorySlug) as string,
      tags: row.tags,
      flags: [],
      thumbnail,
      sku: row.sku ?? null,
      weight: row.weight,
      ...vocabularyFor(row, index, rows, categoryBySlug, vocabulary),
      familyId: row.familyName ? (familyIds.get(normaliseWord(row.familyName)) ?? null) : null,
    });

    row.images.forEach((filename, position) => {
      media.push({
        productId: id,
        kind: "IMAGE",
        ref: row.imageUrls[filename],
        position,
        isThumbnail: filename === coverName,
      });
    });
    if (row.videoRef) {
      media.push({
        productId: id,
        kind: "YOUTUBE",
        ref: row.videoRef,
        position: row.images.length,
        isThumbnail: false,
      });
    }

    for (const [locationName, quantity] of Object.entries(row.stock)) {
      if (quantity <= 0) continue; // zero rows are absent rows, as the form writes them
      stock.push({
        productId: id,
        orgAddressId: locationByName.get(locationName.trim().toLowerCase()) as string,
        quantity,
      });
    }
  });

  const markdowns = await markdownsFor(orgId, rows, plan.updates, productIds);

  // Link each image row to the asset its upload registered (media-library trd D1).
  const assetIds = await mediaAssetRepository.idsByRefs(
    media.filter((row) => row.kind === "IMAGE").map((row) => row.ref),
  );
  for (const row of media) row.assetId = assetIds.get(row.ref) ?? null;

  try {
    await adminProductsRepository.importBulk(products, updates, media, stock);
  } catch (error) {
    if (isUniqueViolation(error, "sku")) {
      throw new ConflictError(
        "A SKU in this sheet was taken while the upload was in progress — re-check and try again.",
        { field: "sku" }
      );
    }
    if (isUniqueViolation(error, "slug")) {
      throw new ConflictError(
        "A product name in this sheet collided with one created while the upload was in progress — try again.",
        { field: "name" }
      );
    }
    throw error;
  }

  // Written as the product form writes them, after the product (offers-hardening Q24) — so a
  // failure here leaves the products saved without their sale prices (TRD D12).
  try {
    for (const markdown of markdowns) await promotionService.setProductMarkdown(markdown);
  } catch (error) {
    throw new DomainError(
      "Your products were saved, but their sale prices were not. Upload the sheet again to set them — rows with a SKU update their product; rows without one would be created a second time, so add their sale prices on the product page instead.",
      { status: 500, cause: error },
    );
  }

  return { created: products.length, updated: updates.length };
}

/**
 * Each row's sale price as the markdown the product form would write. A blank cell on an
 * updating row leaves the product's markdown as it is (the sheet's note says so); a filled one
 * that is not below the price clears it, as the form does. The ceiling is re-checked here,
 * before anything is written, because the route's validation is a separate call.
 */
async function markdownsFor(
  orgId: string,
  rows: RowWithNumber<BulkProductCreateRow>[],
  updates: Map<number, string>,
  productIds: string[],
) {
  const terms = await commercialTermsService.find(orgId);
  const markdowns: Parameters<typeof promotionService.setProductMarkdown>[0][] = [];
  for (const [index, { row, rowNumber }] of rows.entries()) {
    const isUpdate = updates.has(index);
    const productId = productIds[index];
    if (row.salePrice === undefined) continue;
    const price = rupeesToPaise(row.price);
    const sale = rupeesToPaise(row.salePrice);
    const isMarkdown = sale > 0 && sale < price;
    if (!isMarkdown && !isUpdate) continue; // a new product has no markdown to clear
    const breach = isMarkdown && terms
      ? await promotionService.saleBreach({
          productId: isUpdate ? productId : undefined, pricePaise: price, salePricePaise: sale, ceilingBps: terms.maxDiscountBps,
        })
      : null;
    if (breach) throw new DomainError(`Row ${rowNumber}: ${breach}`, { field: "salePrice" });
    markdowns.push({ productId, productName: row.name, orgId, fixedPricePaise: isMarkdown ? sale : null });
  }
  return markdowns;
}
