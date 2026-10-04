import { FACT_DECLARATIONS, ORIGIN, type FactKey } from "@server/catalog/listing-facts";
import { listingValueRepository } from "@server/catalog/listing-value.repository";
import { resolveProductType } from "@server/catalog/product-type";
import { productTypeRepository } from "@server/catalog/product-type.repository";
import type { ProductTypeRecord } from "@server/catalog/product-type.types";

import type { BulkProductRow, RowError } from "./bulk.types";

/**
 * Turning what a sheet said into what a product stores
 * ([listing-vocabulary](../../../docs/specs/listing-vocabulary/)).
 *
 * The sheet offers **labels** in its dropdowns and the product stores **keys**, because renaming
 * a colour must not rewrite products (categories D4). Resolving one to the other needs the
 * database, which is why it is here and not in the row schema — the schema is the shape, this is
 * the meaning.
 *
 * Nothing here refuses a row for an unanswered fact. A product with facts missing saves, sells
 * on this storefront, and is told what is missing — that is the whole vocabulary's rule, and a
 * bulk upload is not the place to break it.
 */

export interface VocabularyContext {
  /** Every live type, by key. */
  types: Map<string, ProductTypeRecord>;
  /** The permitted answers, by list, lower-cased label to stored key. */
  valueKeys: Map<string, Map<string, string>>;
  categories: readonly { id: string; parentId?: string | null; productType?: unknown }[];
}

/** Everything the rows between them could possibly need, in two queries rather than per row. */
export async function loadVocabulary(
  rows: readonly BulkProductRow[],
  categories: VocabularyContext["categories"],
  orgId: string,
): Promise<VocabularyContext> {
  const all = await productTypeRepository.list(true);
  const types = new Map(all.map((type) => [type.key, type]));

  // Only the lists the rows could draw on: a sheet of attar needs no colour list.
  const lists = new Set<string>();
  for (const row of rows) {
    for (const fact of Object.keys(row.factLabels)) {
      const list = FACT_DECLARATIONS[fact as FactKey]?.list;
      if (list) lists.add(list);
    }
  }
  const values = await listingValueRepository.byLists([...lists], orgId);

  const valueKeys = new Map<string, Map<string, string>>();
  for (const [list, options] of Object.entries(values)) {
    const byLabel = new Map<string, string>();
    for (const option of options) {
      byLabel.set(option.label.trim().toLowerCase(), option.key);
      // A key typed directly is accepted too: a sheet round-tripped through an export carries
      // keys, and refusing one would punish the person who did the tidier thing.
      byLabel.set(option.key.trim().toLowerCase(), option.key);
    }
    valueKeys.set(list, byLabel);
  }

  return { types, valueKeys, categories };
}

export interface ResolvedRow {
  productType: string | null;
  kind: string | null;
  facts: Record<string, { value: string | number | boolean; origin: string; unlisted?: boolean }>;
  measurements: Record<string, { value: number; origin: string }>;
}

/**
 * One row's vocabulary, resolved against what exists.
 *
 * The type comes from the row when it names one, else from the category — so one workbook can
 * span several types while a row that says nothing still gets the right questions. A row naming
 * a type its category does not resolve to is refused: that is the one case where guessing would
 * publish a product under the wrong category on a marketplace.
 */
export function resolveRowVocabulary(
  row: BulkProductRow,
  rowNumber: number,
  categoryId: string | undefined,
  context: VocabularyContext,
): { resolved: ResolvedRow; errors: RowError[] } {
  const errors: RowError[] = [];
  const fromCategory = categoryId
    ? resolveProductType(categoryId, context.categories)
    : null;

  let typeKey = fromCategory;
  if (row.productType) {
    if (!context.types.has(row.productType)) {
      errors.push({
        row: rowNumber,
        field: "productType",
        message: `There is no product type "${row.productType}"`,
      });
    } else if (fromCategory && row.productType !== fromCategory) {
      errors.push({
        row: rowNumber,
        field: "productType",
        message: `This category is "${fromCategory}", not "${row.productType}" — change one of them`,
      });
    } else {
      typeKey = row.productType;
    }
  }

  const type = typeKey ? (context.types.get(typeKey) ?? null) : null;

  let kind: string | null = null;
  if (row.kind) {
    if (!type) {
      errors.push({
        row: rowNumber,
        field: "kind",
        message: "This category has no product type, so it holds no kinds",
      });
    } else if (!type.kinds.some((candidate) => candidate.key === row.kind)) {
      errors.push({
        row: rowNumber,
        field: "kind",
        message: `"${row.kind}" is not a kind of ${type.label}`,
      });
    } else {
      kind = row.kind;
    }
  }

  const facts: ResolvedRow["facts"] = {};
  for (const [fact, label] of Object.entries(row.factLabels)) {
    const declaration = FACT_DECLARATIONS[fact as FactKey];
    if (!declaration) continue;
    // A fact the row's type does not ask is dropped rather than stored: it would be an answer
    // to a question this product was never asked.
    if (type && !type.facts.includes(fact as FactKey)) continue;

    if (declaration.answer === "number") {
      const n = Number(label.replace(/,/g, ""));
      if (Number.isFinite(n)) facts[fact] = { value: n, origin: ORIGIN.PRODUCT };
      else errors.push({ row: rowNumber, field: fact, message: `"${label}" is not a number` });
      continue;
    }
    if (declaration.answer === "boolean") {
      facts[fact] = { value: /^(yes|true|y|1)$/i.test(label.trim()), origin: ORIGIN.PRODUCT };
      continue;
    }
    if (declaration.answer === "text" || !declaration.list) {
      facts[fact] = { value: label, origin: ORIGIN.PRODUCT };
      continue;
    }

    const key = context.valueKeys.get(declaration.list)?.get(label.trim().toLowerCase());
    // An answer matching no permitted value is kept as free text and flagged, never discarded
    // (categories D8): a shop's data is not ours to drop for not fitting a list written
    // afterwards, and the leftovers say which answers the list is missing.
    facts[fact] = key
      ? { value: key, origin: ORIGIN.PRODUCT }
      : { value: label, origin: ORIGIN.PRODUCT, unlisted: true };
  }

  const measurements: ResolvedRow["measurements"] = {};
  for (const [measure, value] of Object.entries(row.measurements)) {
    if (type && !type.measures.some((m) => m.key === measure)) continue;
    measurements[measure] = { value, origin: ORIGIN.PRODUCT };
  }

  return { resolved: { productType: typeKey, kind, facts, measurements }, errors };
}
