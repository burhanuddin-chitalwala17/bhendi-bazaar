/**
 * Where a channel field's value comes from, and what a built listing is (listing-model/field-maps D1–D3).
 * Neutral: every channel's maps and every provider's input share these shapes.
 */

/** A map's source (field-maps Q2). */
export const FIELD_SOURCE = {
  ATTRIBUTE: "attribute",
  RULE: "rule",
  CORE: "core",
  SHOP: "shop",
  CONSTANT: "constant",
  /** Nothing we hold can fill it: a developer adds the question (spec R1). */
  DEVELOPER: "developer",
} as const;
export type FieldSource = (typeof FIELD_SOURCE)[keyof typeof FIELD_SOURCE];
export const FIELD_SOURCES = Object.values(FIELD_SOURCE) as readonly FieldSource[];

/** The product's own columns a map may read (Q2). */
export const CORE_KEY = {
  NAME: "name",
  SKU: "sku",
  DESCRIPTION: "description",
  BRAND: "brand",
  WEIGHT: "weight",
  BARCODE: "barcode",
} as const;
export type CoreKey = (typeof CORE_KEY)[keyof typeof CORE_KEY];
export const CORE_KEYS = Object.values(CORE_KEY) as readonly CoreKey[];

/** The shop's settings a map may read (Q2). */
export const SHOP_KEY = { HSN: "hsn" } as const;
export type ShopKey = (typeof SHOP_KEY)[keyof typeof SHOP_KEY];
export const SHOP_KEYS = Object.values(SHOP_KEY) as readonly ShopKey[];

/** A map row with no type of ours applies to every type publishing to the channel type (Q7). */
export const ANY_BB_TYPE = "";

/** One map as the builder reads it. */
export interface FieldMapRow {
  id: string;
  channel: string;
  channelType: string;
  fieldPath: string;
  bbType: string;
  source: string;
  attributeKey: string | null;
  ruleKey: string | null;
  coreKey: string | null;
  shopKey: string | null;
  constant: string | null;
  unitTarget: string | null;
  checkedSource: string;
  checkedOn: Date;
  reason: string;
  /** Our option key → the channel's word. */
  values: Record<string, string>;
}

/** One built value: the field path, and its unit for a measure. */
export interface BuiltField {
  path: string;
  value: string;
  unit?: string;
}

/** Why a field the channel requires is not in the listing (spec hazards; Q6). */
export const GAP_REASON = {
  UNMAPPED: "unmapped",
  MISSING: "missing",
  NO_MATCH: "noMatch",
  DEVELOPER: "developer",
} as const;
export type GapReason = (typeof GAP_REASON)[keyof typeof GAP_REASON];

export interface BuildGap {
  field: string;
  label: string;
  reason: GapReason;
  /** The answer with no pair, for a `noMatch`. */
  answer?: string;
}

export interface BuiltListing {
  fields: BuiltField[];
  gaps: BuildGap[];
}

/** The first segment of a path is the catalogue field it fills (Q8). */
export const fieldOf = (path: string) => path.split(".")[0];
