/**
 * Bulk category creation, the admin variant of the shared core (D6).
 *
 * Rows may parent onto existing categories *or* earlier rows in the same sheet —
 * ids are pre-generated, rows are sorted parents-first, and one createMany lands
 * them together, so acyclicity holds by construction: a new row can only point
 * upward to something that already exists.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@server/shared/prisma";
import type { CategoryAccent, Prisma } from "@prisma/client";
import { categoryRepository } from "@server/catalog/category.repository";
import { slugify } from "@server/shared/slug";
import { BULK_MAX_ROWS, type RowError } from "@server/catalog/bulk/bulk.types";
import { matchImage, imageMatchMessage } from "@server/catalog/bulk/image-match";

export interface BulkCategoryRow {
  name: string;
  description: string;
  /** Parent slug — an existing category's, or an earlier row's name-derived slug. */
  parent?: string;
  accent?: CategoryAccent;
  order?: number;
  /** Hero image filename (validate) — swapped for its Blob URL at create. */
  image: string;
}

export interface BulkCategoryCreateRow extends BulkCategoryRow {
  imageUrl: string;
}

export interface CategoryRowWithNumber<T> {
  rowNumber: number;
  row: T;
}

/**
 * The slug this sheet row will get, for in-sheet parent references. The server
 * still settles final slugs against the unique constraint; matching here only
 * decides which row is meant.
 */
const sheetSlug = (name: string) => slugify(name) || "item";

export async function validateCategoryRows(
  rows: CategoryRowWithNumber<BulkCategoryRow>[],
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

  const existing = new Set((await categoryRepository.listTree()).map((c) => c.slug));
  const provided = providedPaths.map((path) => path.trim());
  const inSheet = new Map<string, number>();

  for (const { row, rowNumber } of rows) {
    const slug = sheetSlug(row.name);
    const firstRow = inSheet.get(slug);
    if (existing.has(slug)) {
      errors.push({
        row: rowNumber,
        field: "name",
        message: `A category named like "${row.name}" already exists.`,
      });
    } else if (firstRow !== undefined) {
      errors.push({
        row: rowNumber,
        field: "name",
        message: `"${row.name}" repeats row ${firstRow} of this sheet.`,
      });
    } else {
      inSheet.set(slug, rowNumber);
    }

    const match = matchImage(row.image, provided);
    if ("kind" in match) {
      errors.push({
        row: rowNumber,
        field: "image",
        message: imageMatchMessage(row.image, match),
      });
    }
  }

  // Parents resolve against existing categories or earlier sheet rows (D6).
  for (const { row, rowNumber } of rows) {
    if (!row.parent) continue;
    const parentRow = inSheet.get(row.parent);
    const definedEarlier = parentRow !== undefined && parentRow < rowNumber;
    if (!existing.has(row.parent) && !definedEarlier) {
      errors.push({
        row: rowNumber,
        field: "parent",
        message: `Parent "${row.parent}" is neither an existing category slug nor an earlier row of this sheet.`,
      });
    }
  }

  return errors;
}

export async function createCategories(
  rows: CategoryRowWithNumber<BulkCategoryCreateRow>[]
): Promise<{ created: number }> {
  const tree = await categoryRepository.listTree();
  const existingBySlug = new Map(tree.map((c) => [c.slug, c.id]));
  const maxOrder = await prisma.category.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const idBySheetSlug = new Map<string, string>();
  const data: Prisma.CategoryCreateManyInput[] = rows.map(({ row }, index) => {
    const id = randomUUID();
    const slug = sheetSlug(row.name);
    idBySheetSlug.set(slug, id);
    return {
      id,
      slug,
      name: row.name,
      description: row.description,
      heroImage: row.imageUrl,
      accent: row.accent ?? "EMERALD",
      order: row.order ?? (maxOrder?.order ?? 0) + 1 + index,
      parentId: null, // filled below once every row has an id
    };
  });
  for (let i = 0; i < rows.length; i++) {
    const parent = rows[i].row.parent;
    if (!parent) continue;
    data[i].parentId = existingBySlug.get(parent) ?? idBySheetSlug.get(parent) ?? null;
  }

  await prisma.category.createMany({ data });
  return { created: rows.length };
}
