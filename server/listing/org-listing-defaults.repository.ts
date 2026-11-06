import { prisma } from "@server/shared/prisma";
import { Prisma } from "@prisma/client";

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
    // `null` clears the map; the JSON column needs Prisma's sentinel to say so.
    const taxCodeByCategory = data.taxCodeByCategory ?? Prisma.JsonNull;
    return await prisma.orgListingDefaults.upsert({
      where: { orgId },
      create: { orgId, countryOfOrigin: data.countryOfOrigin, taxRateBps: data.taxRateBps, taxCodeByCategory },
      update: { countryOfOrigin: data.countryOfOrigin, taxRateBps: data.taxRateBps, taxCodeByCategory },
    });
  }

  /** Whether the shop lists on Amazon as Generic (setup-requests Q35): its own write, so the defaults form's PUT never resets it. */
  async setAmazonGeneric(orgId: string, amazonGeneric: boolean) {
    return await prisma.orgListingDefaults.upsert({ where: { orgId }, create: { orgId, amazonGeneric }, update: { amazonGeneric } });
  }

  /** One category's tax code, only when it has none, under the row's lock (marketplace-facts Q21, D7). */
  async fillTaxCode(orgId: string, categoryId: string, taxCode: string): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      await tx.orgListingDefaults.upsert({ where: { orgId }, create: { orgId }, update: {}, select: { orgId: true } });
      const [row] = await tx.$queryRaw<Array<{ codes: unknown }>>`
        SELECT "taxCodeByCategory" AS codes FROM "OrgListingDefaults" WHERE "orgId" = ${orgId} FOR UPDATE`;
      const codes = row?.codes && typeof row.codes === "object" && !Array.isArray(row.codes) ? (row.codes as Record<string, unknown>) : {};
      const have = codes[categoryId];
      if (typeof have === "string" && have.trim() !== "") return false;
      await tx.orgListingDefaults.update({ where: { orgId }, data: { taxCodeByCategory: { ...codes, [categoryId]: taxCode } as Prisma.InputJsonValue } });
      return true;
    });
  }
}

export const orgListingDefaultsRepository = new OrgListingDefaultsRepository();
