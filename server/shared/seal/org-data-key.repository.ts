import { prisma } from "@server/shared/prisma";

/** The one way to reach `OrgDataKey` (Invariant 5; ADR-0079). Returns wrapped keys only. */

export interface WrappedKey {
  orgId: string;
  version: number;
  wrappedKey: string;
}

export const orgDataKeyRepository = {
  /** The shop's newest key that is not retired. */
  async current(orgId: string): Promise<WrappedKey | null> {
    return await prisma.orgDataKey.findFirst({
      where: { orgId, retiredAt: null },
      orderBy: { version: "desc" },
      select: { orgId: true, version: true, wrappedKey: true },
    });
  },

  async byVersion(orgId: string, version: number): Promise<WrappedKey | null> {
    return await prisma.orgDataKey.findUnique({ where: { orgId_version: { orgId, version } }, select: { orgId: true, version: true, wrappedKey: true } });
  },

  /**
   * Stores version 1 unless a racing writer stored it first; either way answers the shop's current
   * key, so two first seals for one shop end with one key.
   */
  async createFirst(orgId: string, wrappedKey: string): Promise<WrappedKey> {
    await prisma.$executeRaw`
      INSERT INTO "OrgDataKey" ("orgId", "version", "wrappedKey") VALUES (${orgId}, 1, ${wrappedKey})
      ON CONFLICT ("orgId", "version") DO NOTHING`;
    const current = await this.current(orgId);
    // Only a shop whose every key was retired with none replacing it; seal refuses rather than reuse one.
    if (!current) throw new Error("The shop's data keys are all retired");
    return current;
  },

  /** A batch of keys after `after`, in key order, for re-wrapping under a new ring version. */
  async page(after: { orgId: string; version: number } | null, take: number): Promise<WrappedKey[]> {
    return await prisma.orgDataKey.findMany({
      where: after ? { OR: [{ orgId: { gt: after.orgId } }, { orgId: after.orgId, version: { gt: after.version } }] } : {},
      orderBy: [{ orgId: "asc" }, { version: "asc" }],
      take,
      select: { orgId: true, version: true, wrappedKey: true },
    });
  },

  /** Compare-and-set, so a re-wrap never overwrites a key another worker changed meanwhile. */
  async rewrap(key: WrappedKey, wrappedKey: string): Promise<boolean> {
    const { count } = await prisma.orgDataKey.updateMany({
      where: { orgId: key.orgId, version: key.version, wrappedKey: key.wrappedKey },
      data: { wrappedKey },
    });
    return count === 1;
  },
};
