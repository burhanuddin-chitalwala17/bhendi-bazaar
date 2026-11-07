/**
 * The attribute dictionary's closed sets (listing-model/attributes D1, D3). Rows live in the database and
 * come only from migrations (R1); these are the shapes code handles.
 */

/** What shape an answer takes. A test asserts every stored kind is one of these (D1). */
export const ATTRIBUTE_KIND = {
  CHOICE: "choice",
  TEXT: "text",
  NUMBER: "number",
  BOOLEAN: "boolean",
  MEASURE: "measure",
  /** Points at another record: a product's brand (Q5). */
  REFERENCE: "reference",
} as const;
export type AttributeKind = (typeof ATTRIBUTE_KIND)[keyof typeof ATTRIBUTE_KIND];
export const ATTRIBUTE_KINDS = Object.values(ATTRIBUTE_KIND) as readonly AttributeKind[];

/** Who fills an attribute by default (Q6): the product, its brand, or the shop's settings. */
export const ATTRIBUTE_SCOPE = { PRODUCT: "product", BRAND: "brand", SHOP: "shop" } as const;
export type AttributeScope = (typeof ATTRIBUTE_SCOPE)[keyof typeof ATTRIBUTE_SCOPE];

/** The family a measure's canonical unit belongs to (D4): grams, millimetres, millilitres. */
export const UNIT_FAMILY = { WEIGHT: "weight", LENGTH: "length", VOLUME: "volume" } as const;
export type UnitFamily = (typeof UNIT_FAMILY)[keyof typeof UNIT_FAMILY];

/** Where a value came from (R2). `marketplace`: filled from a linked listing (marketplace-facts Q7). */
export const VALUE_SOURCE = { PRODUCT: "product", FAMILY: "family", BRAND: "brand", SHOP: "shop", MARKETPLACE: "marketplace" } as const;
export type ValueSource = (typeof VALUE_SOURCE)[keyof typeof VALUE_SOURCE];

/** The attributes today's brand and shop settings fill (R3, Q6), and the product's brand itself (Q5). */
export const BRAND_ATTRIBUTE = {
  BRAND: "brand",
  COUNTRY_OF_ORIGIN: "countryOfOrigin",
  MANUFACTURER: "manufacturer",
  PACKER: "packer",
  IMPORTER: "importer",
} as const;

/** A brand's parties (D6). */
export const BRAND_PARTY_ROLE = { MAKER: "maker", PACKER: "packer", IMPORTER: "importer" } as const;
export type BrandPartyRole = (typeof BRAND_PARTY_ROLE)[keyof typeof BRAND_PARTY_ROLE];

/** One stored value as the read copy holds it (Q8). */
export interface ProjectedValue {
  v: string | number | boolean;
  unit?: string;
  src: ValueSource;
}
export type ProjectedValues = Record<string, ProjectedValue>;
