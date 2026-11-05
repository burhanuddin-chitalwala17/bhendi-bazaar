import { prisma } from "@server/shared/prisma";

/**
 * The little of a product a readiness answer needs — its type, its kind and its stored facts
 * ([channel-registry](../../docs/specs/channel-registry/) D5).
 *
 * Separate from `product.repository` because it reads a different shape for a different reason:
 * no price, no images, no relations, and no pagination. A shop's whole catalogue is tens or
 * hundreds of rows of three columns, which is one small read rather than a page of products.
 *
 * Archived products are left out: they have left sale, so nothing publishes them.
 */

export interface ReadinessProductRow {
  id: string;
  productType: string | null;
  kind: string | null;
  facts: unknown;
}

export interface ComplaintSubjectRow extends ReadinessProductRow {
  mrpPaise: number | null;
  archivedAt: Date | null;
}

export const productReadinessRepository = {
  /** Products named by our own rows (a marketplace's complaints), across shops, in one read (setup-requests D5). */
  async byIds(ids: readonly string[]): Promise<ComplaintSubjectRow[]> {
    if (ids.length === 0) return [];
    return await prisma.product.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, productType: true, kind: true, facts: true, mrpPaise: true, archivedAt: true },
    });
  },

  /** Each shop's product types in use, for some shops, in one read (setup-requests D9: categories). */
  async typesInUse(orgIds: readonly string[]): Promise<Array<{ orgId: string; productType: string }>> {
    if (orgIds.length === 0) return [];
    const rows = await prisma.product.findMany({
      where: { orgId: { in: [...orgIds] }, archivedAt: null, productType: { not: null } },
      select: { orgId: true, productType: true },
      distinct: ["orgId", "productType"],
    });
    return rows.flatMap((r) => (r.productType ? [{ orgId: r.orgId, productType: r.productType }] : []));
  },

  async subjectsFor(orgId: string): Promise<ReadinessProductRow[]> {
    return await prisma.product.findMany({
      where: { orgId, archivedAt: null },
      select: { id: true, productType: true, kind: true, facts: true },
    });
  },
};
