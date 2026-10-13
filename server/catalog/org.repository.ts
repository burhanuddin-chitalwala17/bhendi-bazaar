// src/server/repositories/admin/org.repository.ts

import { prisma } from "@server/shared/prisma";
import type { Org } from "@prisma/client";
import { OrgRole, Prisma } from "@prisma/client";
import type { CreateOrgInput } from "@server/catalog/org.types";

/**
 * An org is born with its two one-to-one rows, so no read path ever meets an absent profile
 * (org-profile spec trd D4). The introduction a creator types is public face and lands there.
 */
function orgCreateData(data: CreateOrgInput): Prisma.OrgCreateInput {
  const { description, ...org } = data;
  return {
    ...org,
    // Convert empty strings to null for optional fields
    phone: data.phone || null,
    contactPerson: data.contactPerson || null,
    businessName: data.businessName || null,
    gstNumber: data.gstNumber || null,
    panNumber: data.panNumber || null,
    profile: { create: { description: description || null } },
    listingDefaults: { create: {} },
  };
}

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
      relationLoadStrategy: "join",
      include: {
        _count: { select: { products: true } },
        products: {
          select: { stockLocations: { select: { quantity: true } } },
        },
        profile: { select: { description: true, logoUrl: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return orgs.map((org) => ({
      ...org,
      productCount: org._count?.products || 0,
      totalStock:
        org.products?.reduce(
          (sum, p) =>
            sum + p.stockLocations.reduce((s, row) => s + row.quantity, 0),
          0,
        ) || 0,
      products: undefined,
      _count: undefined,
    }));
  }

  /**
   * One page of orgs with their stats, filtered server-side.
   *
   * Separate from `findAllWithStats` because search and paging must happen in the
   * same query as the count — filtering a page that was already sliced reports a
   * total for rows the caller never asked about.
   */
  async findPageWithStats(filters: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }) {
    const search = filters.search?.trim();
    const where: Prisma.OrgWhereInput = {
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { code: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              {
                businessName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              { gstNumber: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [orgs, total] = await Promise.all([
      prisma.org.findMany({
        where,
        relationLoadStrategy: "join",
        include: {
          _count: { select: { products: true } },
          products: {
            select: { stockLocations: { select: { quantity: true } } },
          },
          profile: { select: { description: true, logoUrl: true } },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.org.count({ where }),
    ]);

    return {
      orgs: orgs.map((org) => ({
        ...org,
        productCount: org._count?.products || 0,
        totalStock:
          org.products?.reduce(
            (sum, p) =>
              sum + p.stockLocations.reduce((s, row) => s + row.quantity, 0),
            0,
          ) || 0,
        products: undefined,
        _count: undefined,
      })),
      total,
    };
  }

  /**
   * Find org by ID
   */
  async findById(id: string) {
    const org = await prisma.org.findUnique({
      relationLoadStrategy: "join",
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
        products: {
          select: { stockLocations: { select: { quantity: true } } },
        },
        profile: { select: { description: true, logoUrl: true } },
      },
    });
    if (!org) return null;
    // Calculate stats
    return {
      ...org,
      productCount: org._count?.products || 0,
      totalStock:
        org.products?.reduce(
          (sum, p) =>
            sum + p.stockLocations.reduce((s, row) => s + row.quantity, 0),
          0,
        ) || 0,
      products: undefined, // Remove to avoid sending all products
      _count: undefined, // Remove internal field
    };
  }

  /**
   * The public face of one shop, by handle — or null.
   *
   * Everything a storefront renders and nothing else: no commission, no discount
   * ceiling, no tax identifier, no ledger. That is a property of this select list
   * rather than of the template that consumes it (ADR-0030 decision 7), so no page can
   * leak one by rendering a field it was handed.
   *
   * `isActive` is in the where, not the select: a withdrawn shop is absent, not
   * present-and-hidden, so the caller's only option is `notFound()`.
   */
  async findCurrentHandleForRetired(handle: string, cutoff: Date) {
    const row = await prisma.orgHandleHistory.findFirst({
      where: { handle, retiredAt: { gt: cutoff }, org: { isActive: true } },
      orderBy: { retiredAt: "desc" },
      select: { org: { select: { handle: true } } },
    });
    return row?.org.handle ?? null;
  }

  /**
   * The directory: every shop open for business, alphabetical.
   *
   * A shop with nothing on sale is omitted — the directory exists so a stranger can
   * find somewhere to buy from, and an empty shop is a dead end. Its own URL still
   * works, so nothing an org shared is broken by being absent here.
   */
  async findSummary(id: string) {
    return await prisma.org.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, handle: true },
    });
  }

  /**
   * Move an org to a new handle, in one transaction (ADR-0030 decision 4).
   *
   * Three writes that must stand or fall together:
   *  - the handle being **taken** loses its history rows, or the old address would
   *    redirect away from the shop now living at it — the revert loop (D3e). Rule is
   *    unconditional rather than a revert-only branch, so no later path reopens it.
   *  - the handle being **left** gains one, which is what makes it both redirect and
   *    stay unavailable for the length of the window.
   *  - the org points at the new one.
   *
   * Uniqueness is settled by the constraint, not by a prior existence check: the
   * caller retries on a violation, the way every generated identifier here already
   * does. A held handle belonging to someone else is the one case the constraint
   * cannot see, so the service checks that before calling.
   */
  async changeHandle(orgId: string, current: string, next: string) {
    return await prisma.$transaction(async (tx) => {
      await tx.orgHandleHistory.deleteMany({ where: { handle: next } });
      await tx.orgHandleHistory.create({ data: { handle: current, orgId } });
      return await tx.org.update({
        where: { id: orgId },
        data: { handle: next },
        select: { id: true, handle: true },
      });
    });
  }

  /**
   * Whether another org is holding this handle — the one thing the unique constraint
   * cannot answer, because a held handle lives in the history table, not on `Org`.
   */
  async isHandleHeldByAnother(handle: string, orgId: string, cutoff: Date) {
    const held = await prisma.orgHandleHistory.findFirst({
      where: { handle, retiredAt: { gt: cutoff }, orgId: { not: orgId } },
      select: { id: true },
    });
    return held !== null;
  }

  /** This org's storefront presentation, for its own editor. */
  async updateCommercialTerms(
    id: string,
    terms: { commissionBps: number; maxDiscountBps: number },
  ) {
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
      select: {
        id: true,
        name: true,
        code: true,
        commissionBps: true,
        maxDiscountBps: true,
      },
    });
  }

  /** Name and email for a payout notification — nothing else. */
  async findEmailContact(id: string) {
    return await prisma.org.findUnique({
      where: { id },
      select: { name: true, email: true },
    });
  }

  /** The named few, for a console listing something else keyed by org id. */
  async findSummaries(ids: string[]) {
    return await prisma.org.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
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
    return await prisma.org.create({ data: orgCreateData(data) });
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
      const org = await tx.org.create({ data: orgCreateData(data) });

      await tx.orgMember.create({
        data: { userId, orgId: org.id, role: OrgRole.OWNER },
      });

      return org;
    });
  }

  /**
   * Update org
   */
  /** The introduction is public face and belongs to the profile repository; it is not written here. */
  async update(id: string, data: Omit<Partial<CreateOrgInput>, "description">) {
    const org = data;
    await prisma.org.update({
      where: { id },
      data: {
        ...org,
        // Convert empty strings to null for optional fields
        phone: data.phone || null,
        contactPerson: data.contactPerson || null,
        businessName: data.businessName || null,
        gstNumber: data.gstNumber || null,
        panNumber: data.panNumber || null,
      },
    });
    const orgWithStats = await this.findById(id);
    return orgWithStats;
  }

  async setBlocked(id: string, isBlocked: boolean) {
    await prisma.org.update({
      where: { id },
      data: { isBlocked },
    });
    return await this.findById(id);
  }

  /**
   * Count products for a org.
   *
   * Archived products are counted too, deliberately (ADR-0029): this guards org
   * deletion, and `Product.orgId` is `onDelete: Restrict`, so an archived product
   * blocks the delete exactly as an available one does. Filtering here would let the
   * guard pass and leave the database to refuse.
   */
  async countProducts(orgId: string): Promise<number> {
    return await prisma.product.count({
      where: { orgId },
    });
  }
}

export const orgRepository = new OrgRepository();
