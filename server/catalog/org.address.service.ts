import { orgAddressRepository } from "@server/catalog/org.address.repository";
import type { OrgLocation, OrgLocationWrite } from "@server/catalog/org.address.repository";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

/**
 * Pickup-location management for the org portal (stock-locations R1/R8). The caller
 * passes an orgId that came from a verified membership (withOrg) — every read and
 * write here is scoped by it.
 */
export class OrgAddressService {
  async listLocations(orgId: string): Promise<OrgLocation[]> {
    return orgAddressRepository.listByOrg(orgId);
  }

  async addLocation(orgId: string, input: OrgLocationWrite, userId?: string): Promise<OrgLocation> {
    return orgAddressRepository.add(orgId, input, userId);
  }

  async updateLocation(
    orgId: string,
    locationId: string,
    input: Partial<OrgLocationWrite>
  ): Promise<OrgLocation> {
    const updated = await orgAddressRepository.update(orgId, locationId, input);
    if (!updated) throw new NotFoundError("Pickup location not found");
    return updated;
  }

  /**
   * R8, with a reason: the database refuses via RESTRICT regardless, but "what
   * blocks it" should be named before the buyer of a failed DELETE goes hunting.
   */
  async removeLocation(orgId: string, locationId: string): Promise<void> {
    const location = await orgAddressRepository.findOwned(orgId, locationId);
    if (!location) throw new NotFoundError("Pickup location not found");

    if (location.stockedProducts > 0) {
      throw new DomainError(
        `This location still holds stock for ${location.stockedProducts} product${location.stockedProducts === 1 ? "" : "s"}. Move or zero the stock first.`
      );
    }
    if (location.shipmentCount > 0) {
      throw new DomainError(
        "Parcels have shipped from this location, so it is part of order history and cannot be deleted. Deactivate it instead."
      );
    }

    await orgAddressRepository.remove(orgId, locationId);
  }
}

export const orgAddressService = new OrgAddressService();
