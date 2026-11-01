import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import { orgRepository } from "@server/catalog/org.repository";
import { orgAddressService } from "@server/catalog/org.address.service";
import { productsService } from "@server/catalog/admin.product.service";
import { deriveOnboarding, type OnboardingStatus } from "@server/catalog/org-onboarding.types";
import type { OrgLocation } from "@server/catalog/org.address.types";

/** A courier can collect from it: switched on, with a street and someone to ask for (Q3). */
const canPickUp = (location: OrgLocation) =>
  location.isActive && Boolean(location.addressLine1.trim()) && Boolean(location.contactName.trim());

/**
 * Gathers the facts the setup list is judged on and hands them to `deriveOnboarding`
 * (own-store onboarding D5, D6). Everything is read inside catalog; no rule lives here.
 */
export class OrgOnboardingService {
  async status(orgId: string): Promise<OnboardingStatus> {
    const [settings, marks, locations, stats] = await Promise.all([
      orgProfileRepository.findSettings(orgId),
      orgRepository.findSetupMarks(orgId),
      orgAddressService.listLocations(orgId),
      productsService.getStats(orgId),
    ]);

    return deriveOnboarding({
      // `totalProducts` is the available shelf (ADR-0029): archived products are counted apart.
      productsOnSale: stats.totalProducts,
      pickupReady: locations.some(canPickUp),
      hasLogo: Boolean(settings?.logoUrl),
      hasTagline: Boolean(settings?.tagline?.trim()),
      shared: Boolean(marks?.firstSharedAt),
      hidden: Boolean(marks?.setupHiddenAt),
    });
  }

  /** "Hide for now" (Q6, Q23). A second tap writes nothing. */
  async hide(orgId: string, now: Date = new Date()): Promise<void> {
    await orgRepository.hideSetup(orgId, now);
  }

  /** "Undo", or More → "Setup list". */
  async show(orgId: string): Promise<void> {
    await orgRepository.showSetup(orgId);
  }

  /** The first Share or Copy link tap (Q3); only the first is kept. */
  async markShared(orgId: string, now: Date = new Date()): Promise<void> {
    await orgRepository.markFirstShared(orgId, now);
  }
}

export const orgOnboardingService = new OrgOnboardingService();
