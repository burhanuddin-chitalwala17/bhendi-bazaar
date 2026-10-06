import { orgListingDefaultsRepository } from "./org-listing-defaults.repository";
import {
  percentToBps,
  taxCodesToColumn,
  toListingDefaultsDto,
  type ListingDefaultsInput,
  type OrgListingDefaultsDto,
} from "./org-listing-defaults.types";

/**
 * The org-wide defaults a product starts from (org-profile spec R4, trd D7). Defaults pre-fill
 * and never validate, so there is no "complete" here — an org with none saved reads as empty.
 */
export class OrgListingDefaultsService {
  async get(orgId: string): Promise<OrgListingDefaultsDto> {
    return toListingDefaultsDto(await orgListingDefaultsRepository.findByOrgId(orgId));
  }

  async save(orgId: string, input: ListingDefaultsInput): Promise<OrgListingDefaultsDto> {
    const row = await orgListingDefaultsRepository.upsert(orgId, {
      countryOfOrigin: input.countryOfOrigin,
      taxRateBps: input.taxRatePercent === undefined ? null : percentToBps(input.taxRatePercent),
      taxCodeByCategory: taxCodesToColumn(input.taxCodes),
    });
    return toListingDefaultsDto(row);
  }
}

export const orgListingDefaultsService = new OrgListingDefaultsService();
