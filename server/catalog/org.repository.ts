// src/server/repositories/admin/org.repository.ts

import { prisma } from "@server/shared/prisma";
import type { Org } from "@prisma/client";
import { OrgRole, Prisma } from "@prisma/client";
import type { CreateOrgInput } from "@server/catalog/org.types";
import { FROM_ACTIVE_ORG } from "@server/catalog/product.visibility";
import { enqueue } from "@server/shared/jobs";
import { orgEmailChangedSpec } from "@server/shared/jobs/org-email-changed.job";

/** What Shop details may write on the org (org-profile D7): nothing else is reachable from it. */
export type OrgContactData = { name?: string; phone?: string; email?: string };

export type ContactWrite =
  | { outcome: "saved"; previousEmail: string | null; phoneChange: { from: string | null } | null }
  | { outcome: "stale"; updatedAt: Date }
  | { outcome: "missing" };

/** The client or transaction a read may run on. */
export type OrgDb = Pick<typeof prisma, "org">;

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

  /** Whether the shop can take new products: present, active and not blocked (own-store/bulk-sheet D11). */
  async findStanding(id: string) {
    return await prisma.org.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, isBlocked: true },
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

  /**
   * Each org's discount ceiling — on every storefront render, so two columns and no join. A 100%
   * ceiling clamps nothing and is left out; the default is 50%, so in practice this is every org.
   */
  async listDiscountCeilings(db: OrgDb = prisma) {
    return await db.org.findMany({
      where: { maxDiscountBps: { lt: 10_000 } },
      select: { id: true, maxDiscountBps: true },
    });
  }

  /**
   * Each selling org's default rate and its lowest category rule, through the org's own relation — one
   * row per org, like the ceilings above (offers-hardening D6).
   */
  async listCommissionFloors(db: OrgDb = prisma) {
    return await db.org.findMany({
      relationLoadStrategy: "join",
      // Only shops that can sell — the storefront's own predicate (`FROM_ACTIVE_ORG`).
      where: FROM_ACTIVE_ORG.org,
      select: {
        commissionBps: true,
        commissionRules: { select: { rateBps: true }, orderBy: { rateBps: "asc" }, take: 1 },
      },
    });
  }

  /**
   * Name, mobile and email, only if nobody changed the org since `expectedUpdatedAt` (org-profile D7,
   * Q21). An email change queues the notice to the old address in the same transaction (Q25), so
   * neither exists without the other. `previousEmail` and `phoneChange` are set only when that value moved (a phone may move from none).
   */
  async updateContactIfUnchanged(orgId: string, expectedUpdatedAt: Date, data: OrgContactData): Promise<ContactWrite> {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.org.findUnique({ where: { id: orgId }, select: { name: true, email: true, phone: true } });
      if (!current) return { outcome: "missing" as const };
      const { count } = await tx.org.updateMany({ where: { id: orgId, updatedAt: expectedUpdatedAt }, data });
      if (count === 0) {
        const now = await tx.org.findUnique({ where: { id: orgId }, select: { updatedAt: true } });
        return now ? { outcome: "stale" as const, updatedAt: now.updatedAt } : { outcome: "missing" as const };
      }
      const phoneChange = data.phone !== undefined && data.phone !== current.phone ? { from: current.phone } : null;
      if (data.email === undefined || data.email === current.email) {
        return { outcome: "saved" as const, previousEmail: null, phoneChange };
      }
      await enqueue(tx, orgEmailChangedSpec, { orgId, shopName: data.name ?? current.name, oldEmail: current.email });
      return { outcome: "saved" as const, previousEmail: current.email, phoneChange };
    });
  }

  /**
   * The first of `candidates` no org has and none is holding (org-profile ux Refused): a suggestion
   * only, so the change itself still lets the unique constraint decide.
   */
  async firstFreeHandle(candidates: string[], cutoff: Date): Promise<string | null> {
    const [owned, held] = await Promise.all([
      prisma.org.findMany({ where: { handle: { in: candidates } }, select: { handle: true } }),
      prisma.orgHandleHistory.findMany({
        where: { handle: { in: candidates }, retiredAt: { gt: cutoff } },
        select: { handle: true },
      }),
    ]);
    const taken = new Set([...owned, ...held].map((row) => row.handle));
    return candidates.find((candidate) => !taken.has(candidate)) ?? null;
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

  async findSetupMarks(orgId: string) {
    return await prisma.org.findUnique({
      where: { id: orgId },
      select: { setupHiddenAt: true, firstSharedAt: true },
    });
  }

  // Raw, because Prisma bumps `updatedAt` on every write and `updatedAt` is the contact version
  // Shop details saves against: hiding the list must not make that save stale (onboarding D6).
  // Each is conditional, so a repeated tap writes nothing (Q23).
  async hideSetup(orgId: string, at: Date): Promise<number> {
    return await prisma.$executeRaw`UPDATE "Org" SET "setupHiddenAt" = ${at} WHERE id = ${orgId} AND "setupHiddenAt" IS NULL`;
  }

  async showSetup(orgId: string): Promise<number> {
    return await prisma.$executeRaw`UPDATE "Org" SET "setupHiddenAt" = NULL WHERE id = ${orgId} AND "setupHiddenAt" IS NOT NULL`;
  }

  async markFirstShared(orgId: string, at: Date): Promise<number> {
    return await prisma.$executeRaw`UPDATE "Org" SET "firstSharedAt" = ${at} WHERE id = ${orgId} AND "firstSharedAt" IS NULL`;
  }
}

export const orgRepository = new OrgRepository();
