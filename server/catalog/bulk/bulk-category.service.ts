/**
 * Bulk category creation, the admin variant of the shared core (D6).
 *
 * Rows may parent onto existing categories *or* earlier rows in the same sheet.
 * Ids are pre-generated and one createMany lands them together; acyclicity holds
 * because a `parent` may only name a row above it, so a reference can only point
 * upward. Nothing reorders the sheet — the sheet's own order is the rule, and the
 * error says so when a row breaks it.
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

/**
 * How a `parent` cell is matched.
 *
 * `slugify` is idempotent on a slug, so normalising the cell with the very function
 * that generates slugs accepts both forms — and an admin can write the parent's name
 * exactly as it appears in its own `name` cell. Comparing the cell literally is what
 * made `Men's Clothing` unreferenceable: its slug is `men-s-clothing`, which nobody
 * would guess and the sheet never showed.
 */
const parentKey = (text: string) => slugify(text);

interface ParentTarget {
  /** An existing category. */
  id?: string;
  /** A row of this sheet — the parents-first rule applies to these. */
  rowNumber?: number;
  label: string;
}

interface ParentIndex {
  /** Existing slugs and sheet-row slugs — already mutually unique. */
  bySlug: Map<string, ParentTarget>;
  /** Existing categories by the slug of their *name*. Kept separate because a
   *  category renamed after creation keeps its original slug (Invariant 4), so the
   *  two stop agreeing and one key can reach two different categories. */
  byName: Map<string, ParentTarget>;
  /** Name keys two categories both answer to. */
  ambiguousNames: Map<string, string[]>;
}

const sameTarget = (a: ParentTarget, b: ParentTarget) =>
  a.id !== undefined ? a.id === b.id : a.rowNumber === b.rowNumber;

export interface ExistingCategory {
  id: string;
  name: string;
  slug: string;
}

function buildParentIndex(
  existing: ExistingCategory[],
  rows: CategoryRowWithNumber<{ name: string }>[]
): ParentIndex {
  const bySlug = new Map<string, ParentTarget>();
  for (const category of existing) {
    bySlug.set(category.slug, { id: category.id, label: category.name });
  }
  for (const { row, rowNumber } of rows) {
    const key = sheetSlug(row.name);
    // A row colliding with an existing slug is already a row error; keep the
    // existing category so the two failures do not describe each other.
    if (!bySlug.has(key)) bySlug.set(key, { rowNumber, label: row.name });
  }

  const byName = new Map<string, ParentTarget>();
  const ambiguousNames = new Map<string, string[]>();
  for (const category of existing) {
    const key = parentKey(category.name);
    if (!key) continue;
    const target = { id: category.id, label: category.name };
    const clash = ambiguousNames.get(key);
    if (clash) {
      clash.push(category.name);
      continue;
    }
    const held = byName.get(key);
    if (held && !sameTarget(held, target)) {
      byName.delete(key);
      ambiguousNames.set(key, [held.label, category.name]);
      continue;
    }
    byName.set(key, target);
  }

  return { bySlug, byName, ambiguousNames };
}

function resolveParent(
  index: ParentIndex,
  cell: string
): { target: ParentTarget } | { error: string } {
  const key = parentKey(cell);
  const bySlug = index.bySlug.get(key);
  const byName = index.byName.get(key);

  // One key reaching two different categories is refused, not resolved by
  // precedence. Attaching a subcategory to the wrong parent leaves a tree that is
  // wrong and says nothing about it — the one outcome worse than a rejected sheet.
  if (bySlug && byName && !sameTarget(bySlug, byName)) {
    return {
      error: `Parent "${cell}" could mean "${bySlug.label}" or "${byName.label}" — use the slug of the one you want.`,
    };
  }
  const target = bySlug ?? byName;
  if (target) return { target };

  const names = index.ambiguousNames.get(key);
  if (names) {
    return {
      error: `More than one category is named "${cell}" (${names.join(", ")}) — use the parent's slug instead.`,
    };
  }
  return {
    error: `Parent "${cell}" matches no existing category and no row of this sheet. Write the parent's name exactly as it appears in its own name cell, or its slug.`,
  };
}

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

  const categories = await categoryRepository.listIdentifiers();
  const existing = new Set(categories.map((c) => c.slug));
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

  // Parents resolve against existing categories or earlier sheet rows (D6). The
  // same index resolves them at create, so the two cannot disagree about which
  // category a cell meant.
  const index = buildParentIndex(categories, rows);
  for (const { row, rowNumber } of rows) {
    if (!row.parent) continue;
    const resolved = resolveParent(index, row.parent);
    if ("error" in resolved) {
      errors.push({ row: rowNumber, field: "parent", message: resolved.error });
      continue;
    }

    const { rowNumber: parentRow, label } = resolved.target;
    if (parentRow === rowNumber) {
      errors.push({
        row: rowNumber,
        field: "parent",
        message: `A category cannot be its own parent.`,
      });
    } else if (parentRow !== undefined && parentRow > rowNumber) {
      // The ordering rule is what makes a cycle unrepresentable, so the fix is to
      // move the row rather than to relax the rule.
      errors.push({
        row: rowNumber,
        field: "parent",
        message: `"${label}" is defined on row ${parentRow}, below this one. A parent must come first — move that row above this one.`,
      });
    }
  }

  return errors;
}

export async function createCategories(
  rows: CategoryRowWithNumber<BulkCategoryCreateRow>[]
): Promise<{ created: number }> {
  const index = buildParentIndex(await categoryRepository.listIdentifiers(), rows);
  // The whole table is already loaded and memoised for this request; a separate
  // ORDER BY query for one number would be a second billed read of the same rows.
  const maxOrder = (await categoryRepository.list()).reduce(
    (high, c) => Math.max(high, c.order),
    0
  );

  const idByRow = new Map<number, string>();
  const data: Prisma.CategoryCreateManyInput[] = rows.map(({ row, rowNumber }, position) => {
    const id = randomUUID();
    idByRow.set(rowNumber, id);
    return {
      id,
      slug: sheetSlug(row.name),
      name: row.name,
      description: row.description,
      heroImage: row.imageUrl,
      accent: row.accent ?? "EMERALD",
      order: row.order ?? maxOrder + 1 + position,
      parentId: null, // filled below once every row has an id
    };
  });
  for (let i = 0; i < rows.length; i++) {
    const parent = rows[i].row.parent;
    if (!parent) continue;
    const resolved = resolveParent(index, parent);
    if ("error" in resolved) continue; // validation ran first; nothing to resolve to
    const { id, rowNumber } = resolved.target;
    data[i].parentId = id ?? (rowNumber === undefined ? null : idByRow.get(rowNumber) ?? null);
  }

  await prisma.category.createMany({ data });
  return { created: rows.length };
}
