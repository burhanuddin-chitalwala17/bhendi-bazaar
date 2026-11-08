import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

export interface ChannelStateRow {
  productId: string;
  orgId: string;
  channel: string;
  required: number;
  missing: number;
  missingKeys: string[];
}

/** The one writer of `ProductChannelState` (Invariant 5; dynamic-form D3). */
export const productChannelStateRepository = {
  /** Some products' rows replaced with what was just computed: a channel no longer sold on loses its row. */
  async replace(orgId: string, productIds: readonly string[], rows: readonly ChannelStateRow[], now: Date): Promise<void> {
    if (productIds.length === 0) return;
    await prisma.$transaction(async (tx) => {
      // One refresh of a shop at a time: two overlapping would collide on the unique key or write the older answer last.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`completeness:${orgId}`}))`;
      await tx.productChannelState.deleteMany({ where: { productId: { in: [...productIds] } } });
      await tx.productChannelState.createMany({ data: rows.map((r) => ({ ...r, missingKeys: r.missingKeys as Prisma.InputJsonValue, computedAt: now })) });
    });
  },

  async forProduct(productId: string): Promise<ChannelStateRow[]> {
    const rows = await prisma.productChannelState.findMany({ where: { productId }, orderBy: { channel: "asc" } });
    return rows.map((r) => ({ productId: r.productId, orgId: r.orgId, channel: r.channel, required: r.required, missing: r.missing, missingKeys: Array.isArray(r.missingKeys) ? r.missingKeys.map(String) : [] }));
  },

  /** Per channel, how many of a shop's live products (archived ones hold no rows) miss something, and the most details any misses (R5). */
  async needsFor(orgId: string): Promise<Array<{ channel: string; products: number; details: number }>> {
    const rows = await prisma.productChannelState.groupBy({
      by: ["channel"],
      where: { orgId, missing: { gt: 0 } },
      _count: { _all: true },
      _max: { missing: true },
    });
    return rows.map((r) => ({ channel: r.channel, products: r._count._all, details: r._max.missing ?? 0 }));
  },
};
