import type { Brand, BrandParty } from "@prisma/client";

import { BRAND_PARTY_ROLE, type BrandPartyRole } from "@server/shared/brand-party";

/** A party as the brand form shows it (listing-model/attributes D6). */
export interface BrandPartyDto {
  name: string | null;
  address: string | null;
  pincode: string | null;
}
export { BRAND_PARTY_ROLES, type BrandPartyRole } from "@server/shared/brand-party";

/** What the org portal sees of a brand (org-profile trd D2). Private-face data, never on a storefront payload. */
export interface BrandDto {
  id: string;
  name: string;
  manufacturer: string | null;
  packerOrImporter: string | null;
  countryOfOrigin: string | null;
  isDefault: boolean;
  /** Registered on Amazon; false lists as Generic (listing-model Q10). */
  amazonRegistered: boolean;
  parties: Record<BrandPartyRole, BrandPartyDto>;
  retiredAt: string | null;
}

const EMPTY_PARTY: BrandPartyDto = { name: null, address: null, pincode: null };

export function toBrandDto(brand: Brand & { parties?: BrandParty[] }): BrandDto {
  const row = (role: BrandPartyRole) => brand.parties?.find((p) => p.role === role);
  // A stored party as it is; with none, its old line reads as maker or packer (attributes Q11).
  const party = (role: BrandPartyRole, line: string | null = null): BrandPartyDto => {
    const r = row(role);
    return r ? { name: r.name, address: r.address, pincode: r.pincode } : { ...EMPTY_PARTY, name: line };
  };
  return {
    id: brand.id,
    name: brand.name,
    manufacturer: brand.manufacturer,
    packerOrImporter: brand.packerOrImporter,
    countryOfOrigin: brand.countryOfOrigin,
    isDefault: brand.isDefault,
    amazonRegistered: brand.amazonRegistered,
    parties: {
      maker: party(BRAND_PARTY_ROLE.MAKER, brand.manufacturer),
      packer: party(BRAND_PARTY_ROLE.PACKER, brand.packerOrImporter),
      importer: party(BRAND_PARTY_ROLE.IMPORTER),
    },
    retiredAt: brand.retiredAt ? brand.retiredAt.toISOString() : null,
  };
}
