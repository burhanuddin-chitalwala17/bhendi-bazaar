import { FACT, MEASURE, UNIT, type FactKey, type MeasureDeclaration, type MeasureKey } from "./listing-facts";

/**
 * The nine product types (listing-vocabulary/categories R1). A product type decides which
 * questions a product is asked; it is **not** what a buyer browses — `Category` is that, and a
 * category says which type its products use (categories D1a).
 *
 * Named `productType` after Amazon's own `product_type`, the same concept under the dominant
 * published vocabulary ([ADR-0046](../../docs/adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)).
 */
export const PRODUCT_TYPE = {
  ISLAMIC_WEAR: "islamic-wear",
  TROUSERS: "trousers",
  PRAYER_MAT: "prayer-mat",
  BAG: "bag",
  TRAVEL_POUCH: "travel-pouch",
  FRAGRANCE: "fragrance",
  JEWELLERY: "jewellery",
  SOCKS: "socks",
  COMBO: "combo",
} as const;

export const PRODUCT_TYPES = Object.values(PRODUCT_TYPE);
export type ProductTypeKey = (typeof PRODUCT_TYPES)[number];

/**
 * What a type holds. A kind is a fact on the product, never a type of its own: Flipkart holds
 * abaya, burqa and niqab as one node separated by a `Type` field while Meesho holds three
 * categories, and only a stored fact serves both (categories D1).
 */
export interface KindDeclaration {
  key: string;
  label: string;
}

/** Fact keys and measure keys do not collide, so one list expresses both kinds of axis. */
export type VariantAxis = FactKey | MeasureKey;

export interface ProductTypeDeclaration {
  key: ProductTypeKey;
  label: string;
  kinds: readonly KindDeclaration[];
  /** Asked beyond the spine every product carries. Order is the order the form shows them. */
  facts: readonly FactKey[];
  measures: readonly MeasureDeclaration[];
  /**
   * What makes two members of a family sell separately (variants D1). Declared per type because
   * Flipkart declares its axes per node and no two of its twelve agree — and it can be a
   * measurement rather than a fact, since the same attar in 6 ml and 100 ml is two sellable
   * things.
   */
  variantAxis: readonly VariantAxis[];
  /** Where a type's trade uses another word for a shared fact — Flipkart asks cloth "Fabric". */
  labels?: Partial<Record<FactKey, string>>;
}

const kinds = (...pairs: [string, string][]): KindDeclaration[] =>
  pairs.map(([key, label]) => ({ key, label }));

const measure = (
  key: MeasureDeclaration["key"],
  label: string,
  unit: MeasureDeclaration["unit"],
  required = false,
): MeasureDeclaration => ({ key, label, unit, required });

export const PRODUCT_TYPE_DECLARATIONS: Readonly<Record<ProductTypeKey, ProductTypeDeclaration>> = {
  [PRODUCT_TYPE.ISLAMIC_WEAR]: {
    key: PRODUCT_TYPE.ISLAMIC_WEAR,
    label: "Islamic wear",
    kinds: kinds(
      ["abaya", "Abaya"],
      ["burqa", "Burqa"],
      ["niqab", "Niqab"],
      ["hijab", "Hijab"],
      ["other", "Other Islamic wear"],
    ),
    facts: [
      FACT.COLOUR,
      FACT.MATERIAL,
      FACT.PATTERN,
      FACT.SLEEVE_LENGTH,
      FACT.SLEEVE_STYLING,
      FACT.STITCH_TYPE,
      FACT.AUDIENCE,
      FACT.OCCASION,
      FACT.CARE,
    ],
    // Meesho requires bust and length on an abaya and offers no size label worth storing; the
    // rest are optional there and let a shop answer a size question it is asked elsewhere.
    measures: [
      measure(MEASURE.LENGTH, "Length", UNIT.INCH, true),
      measure(MEASURE.BUST, "Bust", UNIT.INCH, true),
      measure(MEASURE.WAIST, "Waist", UNIT.INCH),
      measure(MEASURE.HIP, "Hip", UNIT.INCH),
      measure(MEASURE.SHOULDER, "Shoulder", UNIT.INCH),
      measure(MEASURE.SLEEVE, "Sleeve", UNIT.INCH),
    ],
    variantAxis: [FACT.COLOUR],
    labels: { [FACT.MATERIAL]: "Fabric" },
  },

  [PRODUCT_TYPE.TROUSERS]: {
    key: PRODUCT_TYPE.TROUSERS,
    label: "Trousers and palazzos",
    kinds: kinds(["trouser", "Trouser"], ["palazzo", "Palazzo"], ["salwar", "Salwar"]),
    facts: [
      FACT.COLOUR,
      FACT.MATERIAL,
      FACT.PATTERN,
      FACT.FIT,
      FACT.WAIST_RISE,
      FACT.WAIST_CLOSURE,
      FACT.SURFACE_STYLING,
      FACT.AUDIENCE,
      FACT.OCCASION,
      FACT.CARE,
    ],
    measures: [
      measure(MEASURE.LENGTH, "Length", UNIT.INCH, true),
      measure(MEASURE.WAIST, "Waist", UNIT.INCH),
    ],
    variantAxis: [FACT.COLOUR],
    labels: { [FACT.MATERIAL]: "Fabric" },
  },

  [PRODUCT_TYPE.PRAYER_MAT]: {
    key: PRODUCT_TYPE.PRAYER_MAT,
    label: "Prayer mat",
    kinds: kinds(["mat", "Prayer mat"], ["carpet", "Carpet"]),
    facts: [FACT.COLOUR, FACT.MATERIAL, FACT.PATTERN, FACT.SHAPE, FACT.CARE, FACT.PACK_QUANTITY],
    // Meesho's mat nodes require real dimensions, so free size does not excuse a shop from these.
    measures: [
      measure(MEASURE.LENGTH, "Length", UNIT.CM, true),
      measure(MEASURE.WIDTH, "Width", UNIT.CM, true),
    ],
    variantAxis: [FACT.COLOUR],
  },

  [PRODUCT_TYPE.BAG]: {
    key: PRODUCT_TYPE.BAG,
    label: "Bag",
    kinds: kinds(
      ["handbag", "Handbag"],
      ["sling", "Sling bag"],
      ["messenger", "Messenger bag"],
      ["backpack", "Backpack"],
      ["tote", "Tote"],
    ),
    facts: [
      FACT.COLOUR,
      FACT.MATERIAL,
      FACT.PATTERN,
      FACT.CLOSURE,
      FACT.STRAP,
      FACT.COMPARTMENTS,
      FACT.WATER_RESISTANT,
      FACT.AUDIENCE,
      FACT.OCCASION,
    ],
    measures: [
      measure(MEASURE.LENGTH, "Length", UNIT.CM, true),
      measure(MEASURE.WIDTH, "Width", UNIT.CM, true),
      measure(MEASURE.HEIGHT, "Height", UNIT.CM, true),
    ],
    variantAxis: [FACT.COLOUR],
  },

  [PRODUCT_TYPE.TRAVEL_POUCH]: {
    key: PRODUCT_TYPE.TRAVEL_POUCH,
    label: "Travel pouch",
    kinds: kinds(["pouch", "Pouch"], ["toiletry-kit", "Toiletry kit"]),
    facts: [FACT.COLOUR, FACT.MATERIAL, FACT.PATTERN, FACT.CLOSURE, FACT.AUDIENCE, FACT.PACK_QUANTITY],
    measures: [
      measure(MEASURE.LENGTH, "Length", UNIT.CM, true),
      measure(MEASURE.WIDTH, "Width", UNIT.CM, true),
      measure(MEASURE.HEIGHT, "Height", UNIT.CM),
    ],
    variantAxis: [FACT.COLOUR],
  },

  [PRODUCT_TYPE.FRAGRANCE]: {
    key: PRODUCT_TYPE.FRAGRANCE,
    label: "Attar and bakhoor",
    // Attar is poured and bakhoor is burned. They are different things on every platform —
    // Amazon PERSONAL_FRAGRANCE against INCENSE — so they are kinds, not one product.
    kinds: kinds(["attar", "Attar"], ["bakhoor", "Bakhoor"], ["incense", "Incense"]),
    facts: [FACT.SCENT_FAMILY, FACT.SHELF_LIFE_MONTHS, FACT.PACK_QUANTITY],
    measures: [measure(MEASURE.CAPACITY, "Capacity", UNIT.ML, true)],
    // The same attar in 6 ml, 12 ml and 100 ml is three sellable things, which is why the axis
    // here is a measurement and not a colour.
    variantAxis: [MEASURE.CAPACITY],
  },

  [PRODUCT_TYPE.JEWELLERY]: {
    key: PRODUCT_TYPE.JEWELLERY,
    label: "Jewellery",
    kinds: kinds(["ring", "Ring"], ["ring-set", "Ring set"], ["toe-ring", "Toe ring"]),
    facts: [
      FACT.COLOUR,
      FACT.PLATING,
      FACT.BASE_MATERIAL,
      FACT.PURITY,
      FACT.GEMSTONE,
      FACT.CERTIFICATION,
      FACT.OCCASION,
      FACT.AUDIENCE,
    ],
    measures: [measure(MEASURE.DIAMETER, "Inner diameter", UNIT.MM, true)],
    variantAxis: [FACT.PLATING, FACT.COLOUR],
  },

  [PRODUCT_TYPE.SOCKS]: {
    key: PRODUCT_TYPE.SOCKS,
    label: "Socks",
    kinds: kinds(
      ["ankle", "Ankle length"],
      ["crew", "Crew"],
      ["knee-high", "Knee high"],
      ["no-show", "No show"],
    ),
    facts: [FACT.COLOUR, FACT.MATERIAL, FACT.PATTERN, FACT.AUDIENCE, FACT.PACK_QUANTITY],
    measures: [measure(MEASURE.LENGTH, "Length", UNIT.CM)],
    variantAxis: [FACT.COLOUR, FACT.PACK_QUANTITY],
    labels: { [FACT.MATERIAL]: "Fabric" },
  },

  [PRODUCT_TYPE.COMBO]: {
    key: PRODUCT_TYPE.COMBO,
    label: "Gift set or combo",
    kinds: kinds(["prayer-set", "Prayer set"], ["gift-set", "Gift set"]),
    // Contents are named rather than linked: a combo is an ordinary product with its own stock
    // (variants D4), which is also how Meesho's Gifting-Combo asks for them.
    facts: [FACT.CONTENTS, FACT.COLOUR, FACT.OCCASION, FACT.PACK_QUANTITY],
    measures: [],
    variantAxis: [FACT.COLOUR],
  },
};

export function isProductType(value: unknown): value is ProductTypeKey {
  return typeof value === "string" && (PRODUCT_TYPES as readonly string[]).includes(value);
}

/** A stored value read defensively: an unknown or absent type reads as none, so a category inherits. */
export function parseProductType(value: unknown): ProductTypeKey | null {
  return isProductType(value) ? value : null;
}

export function declarationFor(key: ProductTypeKey): ProductTypeDeclaration {
  return PRODUCT_TYPE_DECLARATIONS[key];
}

/** The wording a type uses for a fact, which differs where its trade does (`Fabric` against `Material`). */
export function labelForFact(type: ProductTypeDeclaration, fact: FactKey, fallback: string): string {
  return type.labels?.[fact] ?? fallback;
}

export interface ProductTypeSource {
  id: string;
  parentId?: string | null;
  productType?: unknown;
}

/**
 * The type a category's products use: its own, else the nearest ancestor's, else none
 * (categories D1a). Mirrors `resolveShotList` deliberately — same tree, same walk, and the
 * `seen` set is what stops a cycle in a self-referencing tree from hanging the request.
 *
 * Returns null rather than guessing: a product whose tree declares nothing is asked the spine
 * only, which still saves and still sells (categories spec R5 in the parent).
 */
export function resolveProductType(
  categoryId: string | null | undefined,
  categories: readonly ProductTypeSource[],
): ProductTypeKey | null {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const seen = new Set<string>();
  let current = categoryId ? byId.get(categoryId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const own = parseProductType(current.productType);
    if (own) return own;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}
