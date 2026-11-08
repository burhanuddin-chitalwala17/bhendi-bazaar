import type { BrandDto } from "@server/catalog/brand.types";
import { INHERITED_ANSWER, type InheritedAnswer } from "@server/shared/brand-party";

type Party = BrandDto["parties"][keyof BrandDto["parties"]];
const line = (p: Party | undefined) => (p ? [p.name, p.address, p.pincode].map((v) => v?.trim()).filter(Boolean).join(", ") : "") || null;

/**
 * What the product's brand (or, with none, the shop's default brand) fills for each inherited answer, and the
 * shop's country where the brand names none: the same order the value functions and the publish follow (A4).
 */
export function inheritedFrom(brands: readonly BrandDto[], brandId: string | null, shopCountry: string | null): Record<InheritedAnswer, { value: string | null; level: "brand" | "shop"; name: string | null }> {
  const brand = (brandId ? brands.find((b) => b.id === brandId) : brands.find((b) => b.isDefault && !b.retiredAt)) ?? null;
  const fromBrand = (value: string | null) => ({ value, level: "brand" as const, name: brand?.name ?? null });
  return {
    [INHERITED_ANSWER.COUNTRY_OF_ORIGIN]: brand?.countryOfOrigin ? fromBrand(brand.countryOfOrigin) : { value: shopCountry, level: "shop", name: null },
    [INHERITED_ANSWER.MANUFACTURER]: fromBrand(line(brand?.parties.maker) ?? brand?.manufacturer ?? null),
    [INHERITED_ANSWER.PACKER]: fromBrand(line(brand?.parties.packer) ?? brand?.packerOrImporter ?? null),
    [INHERITED_ANSWER.IMPORTER]: fromBrand(line(brand?.parties.importer)),
  } as Record<InheritedAnswer, { value: string | null; level: "brand" | "shop"; name: string | null }>;
}
