import { FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * What columns a bulk sheet has, worked out from the types it is being generated for
 * ([product-form/bulk-sheet](../../../docs/specs/listing-vocabulary/)).
 *
 * **Nothing here is a fixed template.** The sheet is built at the moment it is downloaded, from
 * the types, categories, locations and permitted values that exist then — so adding a product
 * type or a colour changes the next sheet without anybody editing a file. A template generated
 * once would go stale the first time a type was added, and the drift would be invisible until a
 * org's upload was rejected for a column that no longer exists.
 *
 * The shape follows Amazon rather than Flipkart and Meesho: those publish one sheet per
 * category, so an org in twelve of them downloads twelve files. Amazon lets several types be
 * selected and returns one workbook, each row naming its own type. That is far cheaper here,
 * because our vocabulary is twenty-eight facts rather than Amazon's 390 columns.
 */

/** Always present, whatever types the sheet spans. */
export const SPINE_COLUMNS = [
  "productType",
  "kind",
  "name",
  "description",
  "price",
  "salePrice",
  "category",
  "family",
  "sku",
  "weight",
  "tags",
  "images",
  "cover",
  "video",
] as const;

export interface SheetColumn {
  header: string;
  /** Which list the answers come from, when the column is a choice. */
  list?: string;
  /** What the notes sheet says about it. */
  note: string;
}

/**
 * A measurement column is named for its unit, because one measure takes different units in
 * different types: `length` is inches for a garment and centimetres for a mat. One `length`
 * column across both would mean two things, and the person filling it would have no way to tell
 * which — so they are separate columns and a row fills the one its type uses.
 */
export function measureHeader(key: string, unit: string): string {
  return `${key} (${unit})`;
}

/** Every fact column the given types ask for, each named once however many types ask it. */
export function factColumns(types: readonly ProductTypeRecord[]): SheetColumn[] {
  const seen = new Map<FactKey, SheetColumn>();
  for (const type of types) {
    for (const fact of type.facts) {
      if (seen.has(fact)) continue;
      const declaration = FACT_DECLARATIONS[fact];
      if (!declaration) continue;
      // A type may use another word for a shared question — cloth is asked its Fabric — but the
      // column is keyed by the fact, so one column serves every type that asks it. The notes
      // carry the wording.
      const asked = types.filter((candidate) => candidate.facts.includes(fact));
      const labels = [...new Set(asked.map((t) => t.factLabels[fact] ?? declaration.label))];
      seen.set(fact, {
        header: fact,
        list: declaration.list,
        note: `${labels.join(" / ")} — for ${asked.map((t) => t.label).join(", ")}.`,
      });
    }
  }
  return [...seen.values()];
}

/** Every measurement column, one per measure and unit, with which types require it. */
export function measureColumns(types: readonly ProductTypeRecord[]): SheetColumn[] {
  const seen = new Map<string, SheetColumn>();
  for (const type of types) {
    for (const measure of type.measures) {
      const header = measureHeader(measure.key, measure.unit);
      if (seen.has(header)) continue;
      const asked = types.filter((candidate) =>
        candidate.measures.some((m) => m.key === measure.key && m.unit === measure.unit),
      );
      const required = asked.filter((candidate) =>
        candidate.measures.some((m) => m.key === measure.key && m.required),
      );
      seen.set(header, {
        header,
        note:
          `${measure.label} in ${measure.unit} — for ${asked.map((t) => t.label).join(", ")}.` +
          (required.length
            ? ` Required by ${required.map((t) => t.label).join(", ")}.`
            : " Optional."),
      });
    }
  }
  return [...seen.values()];
}

/** The stock columns: one per pickup location the org actually has. */
export function stockColumns(locationNames: readonly string[]): SheetColumn[] {
  return locationNames.map((name) => ({
    header: `stock:${name}`,
    note: "Quantity at this pickup location. Leave empty or 0 for none.",
  }));
}

/** Every column, in the order the sheet shows them. */
export function sheetColumns(
  types: readonly ProductTypeRecord[],
  locationNames: readonly string[],
): SheetColumn[] {
  return [
    ...SPINE_COLUMNS.map((header) => ({ header, note: SPINE_NOTES[header] })),
    ...factColumns(types),
    ...measureColumns(types),
    ...stockColumns(locationNames),
  ];
}

const SPINE_NOTES: Record<(typeof SPINE_COLUMNS)[number], string> = {
  productType:
    "Which kind of thing this row is. It decides which of the later columns apply — leave the " +
    "ones belonging to other types empty. Blank is allowed: the product saves and sells, and " +
    "cannot be published to a marketplace.",
  kind: "Which kind within that type — abaya, rida, attar. See the Types sheet.",
  name: "Product name, 2+ characters.",
  description: "Required.",
  price: "Rupees, e.g. 2499 or 499.50.",
  salePrice:
    "Optional. Below the price; it is stored as an offer, not as a second price. On a row " +
    "that updates a product, leave it empty to keep that product's current sale, or write " +
    "the price itself (or 0) to end it.",
  category: "One of your category slugs. It is also what decides the product type if left blank.",
  family:
    "Optional: the name of a family this belongs to, for the same thing in several colours. " +
    "A family named here that does not exist yet is created once and reused by later rows.",
  sku:
    "Your own code, unique within your organisation. **A row whose SKU matches an existing " +
    "product updates it; a row with a new or empty SKU creates one.**",
  weight: "Kilograms, e.g. 0.6.",
  tags: "Separate multiple values with ; (semicolon).",
  images:
    "Photos for this row, ; separated, in gallery order. First is the cover unless 'cover' " +
    "says otherwise. Include the folder if you upload one: emerald-abaya/front.jpg.",
  cover: "Optional: which of this row's images is the cover, written exactly as in images.",
  video: "Optional: a YouTube link.",
};
