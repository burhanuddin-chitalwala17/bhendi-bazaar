// src/server/repositories/admin/org.repository.ts

import { prisma } from "@server/shared/prisma";
import type { Org } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import type { CreateOrgInput } from "@/domain/org";

export class OrgRepository {
  /**
   * Get all orgs with optional stats
   */
  /** Orgs as stored. */
  async findAll() {
    return await prisma.org.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  /**
   * Orgs with their product count and total stock.
   *
   * A separate method rather than a `includeStats` flag: a boolean that changes the
   * return type cannot be narrowed by callers, which is why the mapping below used to be
   * annotated `any` — and that `any` was hiding a real mismatch with `OrgWithStats`.
   */
  async findAllWithStats() {
    const orgs = await prisma.org.findMany({
      include: {
        _count: { select: { products: true } },
        products: { select: { stockLocations: { select: { quantity: true } } } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return orgs.map((org) => ({
      ...org,
      productCount: org._count?.products || 0,
      totalStock: org.products?.reduce(
        (sum, p) => sum + p.stockLocations.reduce((s, row) => s + row.quantity, 0),
        0
      ) || 0,
      products: undefined,
      _count: undefined,
    }));
  }

  /**
   * Find org by ID
   */
  async findById(id: string) {
    const org = await prisma.org.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
        products: {
          select: { stockLocations: { select: { quantity: true } } },
        },
      },
    });
    if (!org) return null;
    // Calculate stats
    return {
      ...org,
      productCount: org._count?.products || 0,
      totalStock:
        org.products?.reduce(
        (sum, p) => sum + p.stockLocations.reduce((s, row) => s + row.quantity, 0),
        0
      ) || 0,
      products: undefined, // Remove to avoid sending all products
      _count: undefined, // Remove internal field
    };
  }

  /** Set what the platform charges this org. Platform-owned; never org input. */
  async updateCommercialTerms(id: string, terms: { commissionBps: number; maxDiscountBps: number }) {
    return await prisma.org.update({ where: { id }, data: terms });
  }

  /**
   * The commercial terms an offer or a payout needs — nothing else.
   *
   * Distinct from `findById`, which joins products and stock to build console stats;
   * loading that to read one rate would be paying for a page to answer a question.
   */
  async findCommercialTerms(id: string) {
    return await prisma.org.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, commissionBps: true, maxDiscountBps: true },
    });
  }

  /** Every org's terms, for the payout overview. */
  async listCommercialTerms() {
    return await prisma.org.findMany({
      select: { id: true, name: true, code: true, commissionBps: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Find org by code
   */
  async findByCode(code: string) {
    return await prisma.org.findUnique({
      where: { code },
    });
  }

  /**
   * Find org by email
   */
  async findByEmail(email: string) {
    return await prisma.org.findMany({
      where: { email },
    });
  }

  /**
   * Find org by GST number
   */
  async findByGstNumber(gstNumber: string) {
    return await prisma.org.findMany({
      where: { gstNumber },
    });
  }

  /**
   * Create new org
   */
  async create(data: CreateOrgInput): Promise<Org> {
    return await prisma.org.create({
      data: {
        ...data,
        // Convert empty strings to null for optional fields
        phone: data.phone || null,
        contactPerson: data.contactPerson || null,
        businessName: data.businessName || null,
        gstNumber: data.gstNumber || null,
        panNumber: data.panNumber || null,
        description: data.description || null,
      },
    });
  }

  /**
   * Create an org and its first owner as one operation.
   *
   * Both or neither: an org with nobody able to administer it is unreachable, and a
   * membership pointing at an org that failed to create is nonsense. The membership is
   * written here rather than through its own repository because the first owner is part
   * of creating the org — the transaction is the aggregate boundary.
   */
  async createWithOwner(data: CreateOrgInput, userId: string): Promise<Org> {
    return await prisma.$transaction(async (tx) => {
      const org = await tx.org.create({
        data: {
          ...data,
          phone: data.phone || null,
          contactPerson: data.contactPerson || null,
          businessName: data.businessName || null,
          gstNumber: data.gstNumber || null,
          panNumber: data.panNumber || null,
          description: data.description || null,
        },
      });

      await tx.orgMember.create({
        data: { userId, orgId: org.id, role: OrgRole.OWNER },
      });

      return org;
    });
  }

  /**
   * Update org
   */
  async update(id: string, data: Partial<CreateOrgInput>) {
    // after updating return the product count and stock
    await prisma.org.update({
      where: { id },
      data: {
        ...data,
        // Convert empty strings to null for optional fields
        phone: data.phone || null,
        contactPerson: data.contactPerson || null,
        businessName: data.businessName || null,
        gstNumber: data.gstNumber || null,
        panNumber: data.panNumber || null,
        description: data.description || null,
      },
    });
    const orgWithStats = await this.findById(id);
    return orgWithStats;
  }

  /**
   * Delete org
   */
  async delete(id: string): Promise<Org> {
    return await prisma.org.delete({
      where: { id },
    });
  }

  /**
   * Count products for a org
   */
  async countProducts(orgId: string): Promise<number> {
    return await prisma.product.count({
      where: { orgId },
    });
  }
}

export const orgRepository = new OrgRepository();
