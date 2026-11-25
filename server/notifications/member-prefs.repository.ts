import { prisma } from "@server/shared/prisma";

/** The one repository of `MemberNotificationPrefs` (Invariant 5). No row means the defaults. */
export const memberPrefsRepository = {
  async morningEmail(orgId: string, userId: string): Promise<boolean> {
    const row = await prisma.memberNotificationPrefs.findUnique({ where: { orgId_userId: { orgId, userId } }, select: { morningEmail: true } });
    return row?.morningEmail ?? true;
  },

  /** The members of a shop who turned the morning email off; everyone else gets it. */
  async morningEmailOff(orgId: string, userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await prisma.memberNotificationPrefs.findMany({
      where: { orgId, userId: { in: userIds }, morningEmail: false },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  },

  async setMorningEmail(orgId: string, userId: string, morningEmail: boolean): Promise<void> {
    await prisma.memberNotificationPrefs.upsert({
      where: { orgId_userId: { orgId, userId } },
      create: { orgId, userId, morningEmail },
      update: { morningEmail },
    });
  },
};
