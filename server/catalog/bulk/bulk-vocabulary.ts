import { brandService } from "@server/catalog/brand.service";
import { ANSWER, FACT_DECLARATIONS, ORIGIN, type FactKey } from "@server/listing/listing-facts";
import { listingValueRepository } from "@server/listing/listing-value.repository";
import { resolveProductType } from "@server/listing/product-type";
import { productTypeRepository } from "@server/listing/product-type.repository";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

import type { BulkProductRow, RowError } from "./bulk.types";
import { notInListMessage, wordMatcher, YES_NO, type WordMatcher } from "./word-match";

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
 * bulk upload is not the place to break it. An answer outside its list is refused, naming the
 * closest listed one (own-store/bulk-sheet Q8): the sheet offered the list, so a miss is a slip.
 */

export interface VocabularyContext {
  /** Every live type, by key. */
  types: Map<string, ProductTypeRecord>;
  /** The permitted answers, by list: a label or key, however typed, to the stored key (D6). */
  valueKeys: Map<string, WordMatcher<string>>;
  /** The shop's live brands, by name, to their id. */
  brands: WordMatcher<string>;
  categories: readonly { id: string; parentId?: string | null; productType?: unknown }[];
}

const yesNo = wordMatcher(YES_NO);

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
  const [values, brands] = await Promise.all([
    listingValueRepository.byLists([...lists], orgId),
    rows.some((row) => row.brandName) ? brandService.list(orgId) : Promise.resolve([]),
  ]);

  const valueKeys = new Map<string, WordMatcher<string>>();
  for (const [list, options] of Object.entries(values)) {
    // A key typed directly is accepted too: a sheet round-tripped through an export carries
    // keys, and refusing one would punish the person who did the tidier thing.
    valueKeys.set(
      list,
      wordMatcher(options.map((option) => ({ value: option.key, label: option.label, words: [option.label, option.key] }))),
    );
  }
  const brandMatcher = wordMatcher(brands.map((brand) => ({ value: brand.id, label: brand.name, words: [brand.name] })));

  return { types, valueKeys, brands: brandMatcher, categories };
}

export interface ResolvedRow {
  productType: string | null;
  kind: string | null;
  brandId: string | null;
  facts: Record<string, { value: string | number | boolean; origin: string }>;
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
    } else {
      const kinds = wordMatcher(type.kinds.map((k) => ({ value: k.key, label: k.label, words: [k.label, k.key] })));
      kind = kinds.match(row.kind) ?? null;
      if (!kind) {
        errors.push({ row: rowNumber, field: "kind", message: notInListMessage("Kind", row.kind, kinds.closest(row.kind)) });
      }
    }
  }

  let brandId: string | null = null;
  if (row.brandName) {
    brandId = context.brands.match(row.brandName) ?? null;
    if (!brandId) {
      errors.push({
        row: rowNumber,
        field: "brand",
        message: notInListMessage("Brand", row.brandName, context.brands.closest(row.brandName)),
      });
    }
  }

  const facts: ResolvedRow["facts"] = {};
  for (const [fact, label] of Object.entries(row.factLabels)) {
    const declaration = FACT_DECLARATIONS[fact as FactKey];
    if (!declaration) continue;
    // A fact the row's type does not ask is dropped rather than stored: it would be an answer
    // to a question this product was never asked.
    if (type && !type.facts.includes(fact as FactKey)) continue;
    const heading = type?.factLabels[fact as FactKey] ?? declaration.label;

    if (declaration.answer === ANSWER.NUMBER) {
      const n = Number(label.replace(/,/g, ""));
      if (Number.isFinite(n)) facts[fact] = { value: n, origin: ORIGIN.PRODUCT };
      else errors.push({ row: rowNumber, field: fact, message: `"${label}" is not a number` });
      continue;
    }
    if (declaration.answer === ANSWER.BOOLEAN) {
      // Anything but a yes or a no was a slip, and reading it as "no" would publish a guess.
      const answer = yesNo.match(label);
      if (answer === undefined) {
        errors.push({ row: rowNumber, field: fact, message: notInListMessage(heading, label, yesNo.closest(label)) });
      } else {
        facts[fact] = { value: answer, origin: ORIGIN.PRODUCT };
      }
      continue;
    }
    if (declaration.answer === ANSWER.TEXT || !declaration.list) {
      facts[fact] = { value: label, origin: ORIGIN.PRODUCT };
      continue;
    }

    const values = context.valueKeys.get(declaration.list);
    const key = values?.match(label);
    // The sheet offered this list, so an answer outside it is a slip to fix, not data to keep
    // flagged (own-store/bulk-sheet Q8; was categories D8's keep-and-flag). Nothing is saved meanwhile.
    if (key) facts[fact] = { value: key, origin: ORIGIN.PRODUCT };
    else errors.push({ row: rowNumber, field: fact, message: notInListMessage(heading, label, values?.closest(label)) });
  }

  const measurements: ResolvedRow["measurements"] = {};
  for (const [measure, value] of Object.entries(row.measurements)) {
    if (type && !type.measures.some((m) => m.key === measure)) continue;
    measurements[measure] = { value, origin: ORIGIN.PRODUCT };
  }

  return { resolved: { productType: typeKey, kind, brandId, facts, measurements }, errors };
}
