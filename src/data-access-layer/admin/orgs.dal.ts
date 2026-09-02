import { cache } from "react";
import type { OrgWithStats } from "@/domain/org";
import { orgRepository } from "@server/catalog/org.repository";

type OrgRow = Awaited<ReturnType<typeof orgRepository.findAllWithStats>>[number];

/**
 * Persistence shape → client shape. Two things differ and neither is cosmetic: a
 * nullable column reads `null` where the client type says `undefined`, and Prisma
 * returns `Date` where the client type says `string` ([CONTRACTS.md](../../../docs/CONTRACTS.md)
 * rule 3 — JSON has no date type).
 *
 * This mapping used to be an `any` in the repository, which let both mismatches compile.
 */
function toOrgWithStats(org: OrgRow): OrgWithStats {
  return {
    id: org.id,
    code: org.code,
    name: org.name,
    email: org.email,
    phone: org.phone ?? undefined,
    contactPerson: org.contactPerson ?? undefined,
    businessName: org.businessName ?? undefined,
    gstNumber: org.gstNumber ?? undefined,
    panNumber: org.panNumber ?? undefined,
    isActive: org.isActive,
    isVerified: org.isVerified,
    description: org.description ?? undefined,
    logoUrl: org.logoUrl ?? undefined,
    joinedAt: org.joinedAt.toISOString(),
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
    productCount: org.productCount,
    totalStock: org.totalStock,
  };
}

class OrgsDAL {
  getOrgs = cache(async (): Promise<OrgWithStats[]> => {
    const orgs = await orgRepository.findAllWithStats();
    return orgs.map(toOrgWithStats);
  });

  /** One org's identity — for a page that names an org rather than listing them. */
  getOrgSummary = cache(
    async (orgId: string): Promise<{ id: string; name: string; code: string } | null> => {
      return await orgRepository.findSummary(orgId);
    }
  );
}

export const orgsDAL = new OrgsDAL();
