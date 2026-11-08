import { brandService } from "@server/catalog/brand.service";

/**
 * Whether a product lists on Amazon as Generic (listing-model Q10, dynamic-form Q14): its brand's own choice;
 * with no brand, the shop's default brand's; with no default brand either, the shop's old setting.
 */
export async function genericFor(orgId: string, brand: { amazonRegistered: boolean } | null, shopSetting: boolean): Promise<boolean> {
  if (brand) return !brand.amazonRegistered;
  const fallback = (await brandService.list(orgId)).find((b) => b.isDefault);
  return fallback ? !fallback.amazonRegistered : shopSetting;
}
