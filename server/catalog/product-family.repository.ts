import { prisma } from "@server/shared/prisma";

import { AVAILABLE } from "./product.visibility";


/**
 * The one way to reach `ProductFamily` ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)).
 *
 * A family carries what its members share and nothing that can be sold — no price, no stock, no
 * `ProductStock` (listing-vocabulary/variants D3). That is enforced by the columns not existing,
 * so this module has no code to keep it true, which is the point.
 *
 * Every read and write is scoped by `orgId`, so another org's family reads as not found rather
 * than as forbidden.
 */

export interface FamilyRow {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  productType: string | null;
  facts: unknown;
  measurements: unknown;
  variantAxis: string[];
  retiredAt: Date | null;
}

export interface CreateFamilyInput {
  orgId: string;
  name: string;
  description?: string | null;
  productType?: string | null;
  facts?: unknown;
  measurements?: unknown;
  variantAxis?: readonly string[];
}

export interface UpdateFamilyInput {
  name?: string;
  description?: string | null;
  productType?: string | null;
  facts?: unknown;
  measurements?: unknown;
  variantAxis?: readonly string[];
}

const SELECT = {
  id: true,
  orgId: true,
  name: true,
  description: true,
  productType: true,
  facts: true,
  measurements: true,
  variantAxis: true,
  retiredAt: true,
} as const;

export const productFamilyRepository = {
  async create(input: CreateFamilyInput): Promise<FamilyRow> {
    // Whitelisted field by field: the create and the update must stay symmetric, and spreading an
    // input is how a server-owned column gets written from a request body (Invariant 4).
    return prisma.productFamily.create({
      data: {
        orgId: input.orgId,
        name: input.name,
        description: input.description ?? null,
        productType: input.productType ?? null,
        facts: (input.facts ?? undefined) as never,
        measurements: (input.measurements ?? undefined) as never,
        variantAxis: [...(input.variantAxis ?? [])],
      },
      select: SELECT,
    });
  },

  async update(orgId: string, id: string, input: UpdateFamilyInput): Promise<FamilyRow | null> {
    // updateMany, so the org scope is part of the write rather than a read-then-write that two
    // requests can interleave. count === 0 means it is not this org's, which reads as not found.
    const { count } = await prisma.productFamily.updateMany({
      where: { id, orgId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.productType === undefined ? {} : { productType: input.productType }),
        ...(input.facts === undefined ? {} : { facts: input.facts as never }),
        ...(input.measurements === undefined ? {} : { measurements: input.measurements as never }),
        ...(input.variantAxis === undefined ? {} : { variantAxis: [...input.variantAxis] }),
      },
    });
    if (count === 0) return null;
    return this.byId(orgId, id);
  },

  async byId(orgId: string, id: string): Promise<FamilyRow | null> {
    return prisma.productFamily.findFirst({ where: { id, orgId }, select: SELECT });
  },

  /** Retired families are hidden from pickers, never from a product that already names one. */
  async list(orgId: string, includeRetired = false): Promise<FamilyRow[]> {
    return prisma.productFamily.findMany({
      where: { orgId, ...(includeRetired ? {} : { retiredAt: null }) },
      orderBy: { name: "asc" },
      select: SELECT,
    });
  },

  async retire(orgId: string, id: string): Promise<boolean> {
    const { count } = await prisma.productFamily.updateMany({
      where: { id, orgId, retiredAt: null },
      data: { retiredAt: new Date() },
    });
    return count > 0;
  },

  async restore(orgId: string, id: string): Promise<boolean> {
    const { count } = await prisma.productFamily.updateMany({
      where: { id, orgId, retiredAt: { not: null } },
      data: { retiredAt: null },
    });
    return count > 0;
  },

  /**
   * Every member, archived included. This answers "how many products inherit from here", which
   * is what the brand-level correction previews — an archived product can be restored, so
   * correcting it matters as much as correcting a live one.
   */
  async memberCount(orgId: string, id: string): Promise<number> {
    return prisma.product.count({ where: { familyId: id, family: { orgId } } });
  },

  /**
   * The two counts, never one (variants D6). A screen saying "Products" must say which it means:
   * twenty abayas in five colours is twenty families and a hundred sellable things.
   */
  async counts(orgId: string): Promise<{ families: number; sellable: number }> {
    const [families, sellable] = await Promise.all([
      prisma.productFamily.count({ where: { orgId, retiredAt: null } }),
      prisma.product.count({ where: { orgId, ...AVAILABLE } }),
    ]);
    return { families, sellable };
  },
};
