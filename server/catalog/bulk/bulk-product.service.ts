/**
 * Bulk product creation for one org (bulk-catalog-upload).
 *
 * Validation answers "would this sheet import cleanly?" without writing anything;
 * creation is one transaction of createMany per table — 3 statements, not 300
 * (D5), and therefore all-or-nothing by construction (R3).
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import { categoryRepository } from "@server/catalog/category.repository";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { slugify } from "@server/shared/slug";
import { isUniqueViolation } from "@server/shared/constraint";
import { rupeesToPaise } from "@server/shared/money";
import { ConflictError } from "@server/shared/domain-error";
import { matchImage, imageMatchMessage } from "@server/catalog/bulk/image-match";
import {
  BULK_MAX_ROWS,
  type BulkProductRow,
  type BulkProductCreateRow,
  type RowError,
} from "@server/catalog/bulk/bulk.types";

export interface RowWithNumber<T> {
  rowNumber: number;
  row: T;
}

/**
 * Everything that needs the database: categories exist, stock columns name the
 * org's real locations, SKUs are free (in the sheet and in this org), image
 * filenames were actually provided, covers point at their own images.
 */
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
      message: `At most ${BULK_MAX_ROWS} rows per upload — this sheet has ${rows.length}.`,
    });
    return errors;
  }

  const [categories, locations] = await Promise.all([
    categoryRepository.list(),
    orgAddressRepository.listByOrg(orgId),
  ]);
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const locationByName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l]));
  const provided = providedPaths.map((path) => path.trim());

  const skus = rows.flatMap(({ row, rowNumber }) => (row.sku ? [{ sku: row.sku, rowNumber }] : []));
  const taken = skus.length
    ? await prisma.product.findMany({
        where: { orgId, sku: { in: skus.map((s) => s.sku) } },
        select: { sku: true, name: true },
      })
    : [];
  const takenBy = new Map(taken.map((p) => [p.sku as string, p.name]));
  const seenInSheet = new Map<string, number>();

  for (const { row, rowNumber } of rows) {
    if (!categorySlugs.has(row.categorySlug)) {
      errors.push({
        row: rowNumber,
        field: "category",
        message: `Category "${row.categorySlug}" does not exist — see the sample sheet for the current list.`,
      });
    }

    for (const locationName of Object.keys(row.stock)) {
      if (!locationByName.has(locationName.trim().toLowerCase())) {
        errors.push({
          row: rowNumber,
          field: `stock:${locationName}`,
          message: `"${locationName}" is not one of this organisation's pickup locations. Create it on the Locations page first.`,
        });
      }
    }

    if (row.sku) {
      const conflictName = takenBy.get(row.sku);
      if (conflictName) {
        errors.push({
          row: rowNumber,
          field: "sku",
          message: `SKU "${row.sku}" is already used by "${conflictName}".`,
        });
      }
      const firstRow = seenInSheet.get(row.sku);
      if (firstRow !== undefined) {
        errors.push({
          row: rowNumber,
          field: "sku",
          message: `SKU "${row.sku}" is already used by row ${firstRow} of this sheet.`,
        });
      } else {
        seenInSheet.set(row.sku, rowNumber);
      }
    }

    for (const reference of row.images) {
      const match = matchImage(reference, provided);
      if ("kind" in match) {
        errors.push({
          row: rowNumber,
          field: "images",
          message: imageMatchMessage(reference, match),
        });
      }
    }
    if (row.cover && !row.images.includes(row.cover)) {
      errors.push({
        row: rowNumber,
        field: "cover",
        message: `Cover "${row.cover}" is not one of the row's images.`,
      });
    }
  }

  return errors;
}

/**
 * Slugs for every row, honouring existing products and earlier rows: base name,
 * then -2, -3… One read of the existing slugs replaces a per-row availability
 * race — the unique constraint still arbitrates, and a collision in the window
 * fails the whole transaction, which all-or-nothing wants anyway.
 */
async function assignSlugs(rows: RowWithNumber<BulkProductCreateRow>[]): Promise<string[]> {
  const existing = new Set(
    (await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug)
  );
  return rows.map(({ row }) => {
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
): Promise<{ created: number }> {
  const locations = await orgAddressRepository.listByOrg(orgId);
  const locationByName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l.id]));
  const tree = await categoryRepository.listTree();
  const categoryBySlug = new Map(tree.map((c) => [c.slug, c.id]));
  const slugs = await assignSlugs(rows);

  const products: Prisma.ProductCreateManyInput[] = [];
  const media: {
    productId: string;
    kind: "IMAGE" | "YOUTUBE";
    ref: string;
    position: number;
    isThumbnail: boolean;
  }[] = [];
  const stock: { productId: string; orgAddressId: string; quantity: number }[] = [];

  rows.forEach(({ row }, index) => {
    const id = randomUUID();
    const coverName = row.cover ?? row.images[0];
    const thumbnail = row.imageUrls[coverName];

    products.push({
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
      sizes: row.sizes,
      colors: row.colors,
      sku: row.sku ?? null,
      weight: row.weight,
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.createMany({ data: products });
      if (media.length) await tx.productMedia.createMany({ data: media });
      if (stock.length) await tx.productStock.createMany({ data: stock });
    });
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

  return { created: rows.length };
}
