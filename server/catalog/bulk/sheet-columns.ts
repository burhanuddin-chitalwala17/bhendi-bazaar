import { ANSWER, FACT_DECLARATIONS } from "@server/listing/listing-facts";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * The columns of one tab of the bulk sheet, worked out from that tab's type at download time
 * ([own-store/bulk-sheet](../../../docs/specs/own-store/bulk-sheet/trd.md) D1, D2).
 *
 * Nothing here is a fixed template: adding a type or a fact changes the next download with no
 * file to edit. A column's `key` is what the upload reads (a hidden row), its `heading` is only
 * for people, so a renamed heading breaks nothing (Q5).
 */
export interface SheetColumn {
  key: string;
  heading: string;
  /** The one line under the heading (R3). */
  help: string;
  /** An orange heading: the row is refused without it. */
  required: boolean;
  /** Which value list the dropdown draws on, when the column is a choice. */
  list?: string;
}

/** The lists the sheet itself adds to the vocabulary's; none shares a name with a fact's list. */
export const SHEET_LIST = {
  CATEGORY: "category",
  KIND: "kind",
  FAMILY: "family",
  BRAND: "brand",
  YES_NO: "yesno",
} as const;

/** The help line of every dropdown column (ux.md, phone apps that ignore dropdowns). */
export const LIST_HELP = "Pick from the list. On a phone app without lists, copy a value from the Lists guide on Instructions.";

/** The columns every tab has, in order. `name` is first, so the example's marker reads as its name. */
export const SPINE_COLUMNS = [
  "name",
  "kind",
  "description",
  "price",
  "salePrice",
  "category",
  "family",
  "brand",
  "sku",
  "weight",
  "tags",
  "images",
  "cover",
  "video",
] as const;

type SpineKey = (typeof SPINE_COLUMNS)[number];

export const VIDEO_HELP = "YouTube link only. Add a video file from the product form after upload.";

const SPINE: Record<SpineKey, Omit<SheetColumn, "key">> = {
  name: { heading: "Product name", required: true, help: "2 or more characters." },
  kind: { heading: "Kind", required: false, help: LIST_HELP, list: SHEET_LIST.KIND },
  description: { heading: "Description", required: true, help: "What a buyer should know." },
  price: { heading: "Price (₹)", required: true, help: "Rupees, e.g. 2499 or 499.50." },
  salePrice: {
    heading: "Sale price (₹)",
    required: false,
    help: "Optional, below the price. On an update, empty keeps the current sale and 0 ends it.",
  },
  category: { heading: "Category", required: true, help: LIST_HELP, list: SHEET_LIST.CATEGORY },
  family: {
    heading: "Family",
    required: false,
    help: "Optional: one name for the same thing in several colours. A new name is created once.",
    list: SHEET_LIST.FAMILY,
  },
  brand: { heading: "Brand", required: false, help: LIST_HELP, list: SHEET_LIST.BRAND },
  sku: {
    heading: "SKU",
    required: false,
    help: "Your own code. A row whose SKU matches a product updates it; a new or empty SKU creates one.",
  },
  weight: { heading: "Weight (kg)", required: true, help: "Kilograms, e.g. 0.6." },
  tags: { heading: "Tags", required: false, help: "Separate several with ; (semicolon)." },
  images: {
    heading: "Photos",
    required: true,
    help: "Folder and file, ; separated, in gallery order: emerald-abaya/front.jpg",
  },
  cover: { heading: "Cover photo", required: false, help: "Optional: which photo is the cover, as written in Photos." },
  video: { heading: "Video", required: false, help: VIDEO_HELP },
};

/**
 * A measurement column is keyed by its unit, because one measure takes different units in
 * different types — `length` is inches for a garment and centimetres for a mat.
 */
export function measureHeader(key: string, unit: string): string {
  return `${key} (${unit})`;
}

/** The questions this type asks, each headed in the type's own word for it (cloth asks Fabric). */
export function factColumns(type: ProductTypeRecord | null): SheetColumn[] {
  return (type?.facts ?? []).flatMap((fact) => {
    const declaration = FACT_DECLARATIONS[fact];
    if (!declaration) return [];
    return [{
      key: fact,
      heading: type?.factLabels[fact] ?? declaration.label,
      help: listOf(declaration) ? LIST_HELP : "Optional.",
      required: false,
      list: listOf(declaration),
    }];
  });
}

function listOf(declaration: (typeof FACT_DECLARATIONS)[keyof typeof FACT_DECLARATIONS]): string | undefined {
  return declaration.answer === ANSWER.BOOLEAN ? SHEET_LIST.YES_NO : declaration.list;
}

export function measureColumns(type: ProductTypeRecord | null): SheetColumn[] {
  return (type?.measures ?? []).map((measure) => ({
    key: measureHeader(measure.key, measure.unit),
    heading: `${measure.label} (${measure.unit})`,
    help: `${measure.label} in ${measure.unit}.${measure.required ? "" : " Optional."}`,
    required: measure.required,
  }));
}

/** One stock column per pickup location the shop actually has. */
export function stockColumns(locationNames: readonly string[]): SheetColumn[] {
  return locationNames.map((name) => ({
    key: `stock:${name}`,
    heading: `Stock at ${name}`,
    help: "How many are kept here. Empty or 0 for none.",
    required: false,
  }));
}

/**
 * Every column of one tab, in the order it shows them. A type with no kinds asks no kind, and a
 * shop with no brand gets no Brand column: an empty dropdown is a question with no answer.
 */
export function tabColumns(
  type: ProductTypeRecord | null,
  locationNames: readonly string[],
  options: { brands?: boolean } = {},
): SheetColumn[] {
  const spine = SPINE_COLUMNS.filter(
    (key) => (key !== "kind" || (type?.kinds.length ?? 0) > 0) && (key !== "brand" || options.brands),
  );
  return [
    ...spine.map((key) => ({ key, ...SPINE[key] })),
    ...factColumns(type),
    ...measureColumns(type),
    ...stockColumns(locationNames),
  ];
}
