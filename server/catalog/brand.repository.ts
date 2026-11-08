import type { Prisma } from "@prisma/client";

import { BRAND_PARTY_ROLE, BRAND_PARTY_ROLES, type BrandPartyRole } from "@server/shared/brand-party";
import { prisma } from "@server/shared/prisma";
import { productValueRepository } from "@server/listing/product-value.repository";

export interface BrandData {
  name: string;
  manufacturer: string | null;
  packerOrImporter: string | null;
  countryOfOrigin: string | null;
  isDefault: boolean;
}

export interface PartyData {
  name: string | null;
  address: string | null;
  pincode: string | null;
}
export type PartiesData = Record<BrandPartyRole, PartyData>;

const WITH_PARTIES = { parties: true } as const;

/**
 * A brand's parties replaced together, in the caller's transaction (listing-model/attributes D6). The two
 * old lines follow the maker and packer until retire-old-paths drops them, so every reader still agrees.
 */
async function writeParties(tx: Prisma.TransactionClient, brandId: string, parties: PartiesData): Promise<void> {
  for (const role of BRAND_PARTY_ROLES) {
    const p = parties[role];
    if (!p.name && !p.address && !p.pincode) await tx.brandParty.deleteMany({ where: { brandId, role } });
    else await tx.brandParty.upsert({ where: { brandId_role: { brandId, role } }, create: { brandId, role, ...p }, update: p });
  }
  await tx.brand.update({ where: { id: brandId }, data: { manufacturer: parties[BRAND_PARTY_ROLE.MAKER].name, packerOrImporter: parties[BRAND_PARTY_ROLE.PACKER].name } });
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
      include: WITH_PARTIES,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async findById(orgId: string, id: string) {
    return await prisma.brand.findFirst({ where: { id, orgId }, include: WITH_PARTIES });
  }

  async create(orgId: string, data: BrandData, amazonRegistered = true, parties?: PartiesData) {
    return await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({ data: { orgId, ...data, amazonRegistered } });
      if (parties) await writeParties(tx, brand.id, parties);
      // What the brand fills reaches its products in this transaction (listing-model/dynamic-form Q16).
      await productValueRepository.refreshForBrandIn(tx, brand.id);
      return await tx.brand.findUniqueOrThrow({ where: { id: brand.id }, include: WITH_PARTIES });
    });
  }

  /** Scoped by org in the `where`, so a member of one org cannot edit another's brand by id. */
  async update(orgId: string, id: string, data: Partial<BrandData> & { amazonRegistered?: boolean }, parties?: PartiesData) {
    return await prisma.$transaction(async (tx) => {
      // Read before the write: a brand stopping being the default still filled the shop's brandless products (review S2).
      const was = await tx.brand.findFirst({ where: { id, orgId }, select: { isDefault: true } });
      const result = await tx.brand.updateMany({ where: { id, orgId, retiredAt: null }, data });
      if (result.count !== 1) return false;
      if (parties) await writeParties(tx, id, parties);
      await productValueRepository.refreshForBrandIn(tx, id, was?.isDefault ?? false);
      return true;
    });
  }

  /** One default per org: setting it here clears it from every other brand in the same statement pair. */
  async markDefault(orgId: string, id: string) {
    await prisma.$transaction(async (tx) => {
      const previous = await tx.brand.findMany({ where: { orgId, isDefault: true, NOT: { id } }, select: { id: true } });
      await tx.brand.updateMany({ where: { orgId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      await tx.brand.updateMany({ where: { id, orgId, retiredAt: null }, data: { isDefault: true } });
      // The shop's brandless products now take this brand's details (dynamic-form Q16).
      await productValueRepository.refreshForBrandIn(tx, id);
      for (const p of previous) await productValueRepository.refreshForBrandIn(tx, p.id);
    });
  }

  /** The brand a marketplace's brand name names, by name, ignoring case; retired ones never (marketplace-facts Q29). */
  async findForMarketplace(orgId: string, name: string | null) {
    return await prisma.brand.findFirst({
      where: { orgId, retiredAt: null, ...(name ? { name: { equals: name, mode: "insensitive" } } : { isDefault: true }) },
      select: { id: true },
    });
  }

  /** Each field only where it is still empty, so what the shop wrote meanwhile wins (marketplace-facts D7). */
  async fillEmpty(orgId: string, id: string, fields: Partial<Pick<BrandData, "manufacturer" | "packerOrImporter" | "countryOfOrigin">>) {
    return await prisma.$transaction(async (tx) => {
      const filled: string[] = [];
      for (const [field, value] of Object.entries(fields)) {
        if (!value) continue;
        const result = await tx.brand.updateMany({
          where: { id, orgId, retiredAt: null, OR: [{ [field]: null }, { [field]: "" }] },
          data: { [field]: value },
        });
        if (result.count === 1) filled.push(field);
      }
      if (filled.length > 0) await productValueRepository.refreshForBrandIn(tx, id);
      return filled;
    });
  }

  async retire(orgId: string, id: string, now: Date = new Date()) {
    return await prisma.$transaction(async (tx) => {
      const was = await tx.brand.findFirst({ where: { id, orgId }, select: { isDefault: true } });
      const result = await tx.brand.updateMany({ where: { id, orgId, retiredAt: null }, data: { retiredAt: now, isDefault: false } });
      if (result.count === 1) await productValueRepository.refreshForBrandIn(tx, id, was?.isDefault ?? false);
      return result.count === 1;
    });
  }
}

export const brandRepository = new BrandRepository();
