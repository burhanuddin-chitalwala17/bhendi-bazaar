import type { Brand } from "@prisma/client";

/** What the org portal sees of a brand (org-profile trd D2). Private-face data, never on a storefront payload. */
export interface BrandDto {
  id: string;
  name: string;
  manufacturer: string | null;
  packerOrImporter: string | null;
  countryOfOrigin: string | null;
  isDefault: boolean;
  retiredAt: string | null;
}

export function toBrandDto(brand: Brand): BrandDto {
  return {
    id: brand.id,
    name: brand.name,
    manufacturer: brand.manufacturer,
    packerOrImporter: brand.packerOrImporter,
    countryOfOrigin: brand.countryOfOrigin,
    isDefault: brand.isDefault,
    retiredAt: brand.retiredAt ? brand.retiredAt.toISOString() : null,
  };
}
