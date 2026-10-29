import { prisma } from "@server/shared/prisma";

import type { MarketplaceLocation } from "./providers/stock";

/**
 * The one way to reach `ChannelLocation` (Invariant 5): a connected account's marketplace locations
 * and the shop's location each stands for (inventory-sync D1). Never deleted: one not seen is gone.
 */

const SELECT = {
  id: true,
  connectionId: true,
  externalId: true,
  name: true,
  pincode: true,
  orgAddressId: true,
  notUsed: true,
  matchedAt: true,
  goneAt: true,
} as const;

export const channelLocationRepository = {
  /** What one read of the marketplace saw: new ones arrive unmatched, seen ones come back, unseen ones are gone. */
  async recordSeen(connection: { id: string; orgId: string }, seen: readonly MarketplaceLocation[], now: Date): Promise<void> {
    await prisma.$transaction([
      ...seen.map((l) =>
        prisma.channelLocation.upsert({
          where: { connectionId_externalId: { connectionId: connection.id, externalId: l.externalId } },
          create: { connectionId: connection.id, orgId: connection.orgId, externalId: l.externalId, name: l.name, pincode: l.pincode, firstSeenAt: now, lastSeenAt: now },
          update: { name: l.name, pincode: l.pincode, lastSeenAt: now, goneAt: null },
          select: { id: true },
        }),
      ),
      prisma.channelLocation.updateMany({
        where: { connectionId: connection.id, goneAt: null, externalId: { notIn: seen.map((l) => l.externalId) } },
        data: { goneAt: now },
      }),
    ]);
  },

  /** A connection's locations; `closed` when the shop location matched to one has since been closed. */
  async forConnection(connectionId: string, db: Pick<typeof prisma, "channelLocation"> = prisma) {
    const rows = await db.channelLocation.findMany({
      where: { connectionId },
      select: { ...SELECT, orgAddress: { select: { isActive: true } } },
      orderBy: [{ goneAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    });
    return rows.map(({ orgAddress, ...row }) => ({ ...row, closed: orgAddress !== null && !orgAddress.isActive }));
  },

  /** The owner's matches, each to one of the shop's locations or "not used" (Q15, Q16); only this org's rows. */
  async saveMatches(
    orgId: string,
    connectionId: string,
    matches: ReadonlyArray<{ id: string; orgAddressId: string | null; notUsed: boolean }>,
    now: Date,
  ): Promise<number> {
    const results = await prisma.$transaction(
      matches.map((m) =>
        prisma.channelLocation.updateMany({
          where: { id: m.id, orgId, connectionId },
          data: { orgAddressId: m.notUsed ? null : m.orgAddressId, notUsed: m.notUsed, matchedAt: m.notUsed || m.orgAddressId ? now : null },
        }),
      ),
    );
    return results.reduce((n, r) => n + r.count, 0);
  },
};
