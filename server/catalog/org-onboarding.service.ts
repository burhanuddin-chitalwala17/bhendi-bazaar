import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import { brandService } from "@server/catalog/brand.service";
import { orgListingDefaultsService } from "@server/catalog/org-listing-defaults.service";
import { orgAddressService } from "@server/catalog/org.address.service";
import { productsService } from "@server/catalog/admin.product.service";
import { deriveOnboarding, type OnboardingStatus } from "@server/catalog/org-onboarding.types";

/**
 * Gathers the facts onboarding is judged on and hands them to `deriveOnboarding` (org-profile
 * spec R7, trd D8). Everything is read through the module that owns it, all inside catalog, and
 * no rule lives here — the rules are pure, in the types file, where they are tested.
 */
export class OrgOnboardingService {
  async status(orgId: string): Promise<OnboardingStatus> {
    const [settings, brands, defaults, locations, stats] = await Promise.all([
      orgProfileRepository.findSettings(orgId),
      brandService.list(orgId),
      orgListingDefaultsService.get(orgId),
      orgAddressService.listLocations(orgId),
      productsService.getStats(orgId),
    ]);

    return deriveOnboarding({
      hasDescription: Boolean(settings?.description?.trim()),
      brandCount: brands.length,
      hasDefaults:
        defaults.countryOfOrigin !== null ||
        defaults.taxRatePercent !== null ||
        defaults.taxCodes.length > 0,
      // A pickup location that is switched off cannot ship, so it does not make the store ready.
      locationCount: locations.filter((location) => location.isActive).length,
      // `totalProducts` is the available shelf (ADR-0029): archived products are counted apart.
      productsOnSale: stats.totalProducts,
    });
  }
}

export const orgOnboardingService = new OrgOnboardingService();
