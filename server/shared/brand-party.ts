/**
 * Who makes, packs or imports a brand's goods (listing-model/attributes D6): one closed set read by catalog
 * (the brand form) and listing (what the parties fill), so neither imports the other.
 */
export const BRAND_PARTY_ROLE = { MAKER: "maker", PACKER: "packer", IMPORTER: "importer" } as const;
export type BrandPartyRole = (typeof BRAND_PARTY_ROLE)[keyof typeof BRAND_PARTY_ROLE];
export const BRAND_PARTY_ROLES = Object.values(BRAND_PARTY_ROLE) as readonly BrandPartyRole[];
