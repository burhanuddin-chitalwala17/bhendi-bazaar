import { prisma } from "@server/shared/prisma";

export interface BrandData {
  name: string;
  manufacturer: string | null;
  packerOrImporter: string | null;
  countryOfOrigin: string | null;
  isDefault: boolean;
}

/**
 * The one reader and writer of `Brand` (ADR-0003). Lists exclude retired brands by default
 * and a retired brand stays readable by id, because products will keep pointing at it
 * (org-profile spec R9, trd D6). Nothing here deletes.
 */
export class BrandRepository {
  async listForOrg(orgId: string, options: { includeRetired?: boolean } = {}) {
    return await prisma.brand.findMany({
      where: { orgId, ...(options.includeRetired ? {} : { retiredAt: null }) },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async findById(orgId: string, id: string) {
    return await prisma.brand.findFirst({ where: { id, orgId } });
  }

  async create(orgId: string, data: BrandData) {
    return await prisma.brand.create({ data: { orgId, ...data } });
  }

  /** Scoped by org in the `where`, so a member of one org cannot edit another's brand by id. */
  async update(orgId: string, id: string, data: Partial<BrandData>) {
    const result = await prisma.brand.updateMany({ where: { id, orgId, retiredAt: null }, data });
    return result.count === 1;
  }

  /** One default per org: setting it here clears it from every other brand in the same statement pair. */
  async markDefault(orgId: string, id: string) {
    await prisma.$transaction([
      prisma.brand.updateMany({ where: { orgId, isDefault: true, NOT: { id } }, data: { isDefault: false } }),
      prisma.brand.updateMany({ where: { id, orgId, retiredAt: null }, data: { isDefault: true } }),
    ]);
  }

  async retire(orgId: string, id: string, now: Date = new Date()) {
    const result = await prisma.brand.updateMany({
      where: { id, orgId, retiredAt: null },
      data: { retiredAt: now, isDefault: false },
    });
    return result.count === 1;
  }
}

export const brandRepository = new BrandRepository();
