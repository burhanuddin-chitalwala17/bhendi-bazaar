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

export const productReadinessRepository = {
  async subjectsFor(orgId: string): Promise<ReadinessProductRow[]> {
    return await prisma.product.findMany({
      where: { orgId, archivedAt: null },
      select: { id: true, productType: true, kind: true, facts: true },
    });
  },
};
