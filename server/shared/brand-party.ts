/**
 * Who makes, packs or imports a brand's goods (listing-model/attributes D6): one closed set read by catalog
 * (the brand form) and listing (what the parties fill), so neither imports the other.
 */
export const BRAND_PARTY_ROLE = { MAKER: "maker", PACKER: "packer", IMPORTER: "importer" } as const;
export type BrandPartyRole = (typeof BRAND_PARTY_ROLE)[keyof typeof BRAND_PARTY_ROLE];
export const BRAND_PARTY_ROLES = Object.values(BRAND_PARTY_ROLE) as readonly BrandPartyRole[];

/**
 * What a brand (or the shop) fills that a product may set for itself (listing-model/dynamic-form A4, R3): kept as
 * the product's own answer under the same key, which the brand's value never goes over.
 */
export const INHERITED_ANSWER = { COUNTRY_OF_ORIGIN: "countryOfOrigin", MANUFACTURER: "manufacturer", PACKER: "packer", IMPORTER: "importer" } as const;
export type InheritedAnswer = (typeof INHERITED_ANSWER)[keyof typeof INHERITED_ANSWER];
export const INHERITED_ANSWERS = Object.values(INHERITED_ANSWER) as readonly InheritedAnswer[];
