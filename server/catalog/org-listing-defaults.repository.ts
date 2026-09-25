import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";

export interface ListingDefaultsData {
  countryOfOrigin: string | null;
  taxRateBps: number | null;
  taxCodeByCategory: Prisma.InputJsonValue | null;
}

/**
 * The one reader and writer of `OrgListingDefaults` (ADR-0003): the private listing context
 * that belongs to the shop rather than to a brand (org-profile spec R4). Read by the resolver
 * that listing-schema brings; written from the portal's listing-context screen.
 */
export class OrgListingDefaultsRepository {
  async findByOrgId(orgId: string) {
    return await prisma.orgListingDefaults.findUnique({ where: { orgId } });
  }

  async upsert(orgId: string, data: ListingDefaultsData) {
    const taxCodeByCategory = data.taxCodeByCategory ?? undefined;
    return await prisma.orgListingDefaults.upsert({
      where: { orgId },
      create: { orgId, countryOfOrigin: data.countryOfOrigin, taxRateBps: data.taxRateBps, taxCodeByCategory },
      update: { countryOfOrigin: data.countryOfOrigin, taxRateBps: data.taxRateBps, taxCodeByCategory },
    });
  }
}

export const orgListingDefaultsRepository = new OrgListingDefaultsRepository();
