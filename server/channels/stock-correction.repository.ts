import { prisma } from "@server/shared/prisma";

/** The one way to reach `StockCorrection` (Invariant 5): what the daily check put back (inventory-sync D5). */
export const stockCorrectionRepository = {
  async record(input: { connectionId: string; orgId: string; listingId: string; title: string; theirs: number; ours: number }): Promise<void> {
    await prisma.stockCorrection.create({ data: input, select: { id: true } });
  },

  /** Since a moment, newest first: the section shows today's. */
  async since(connectionId: string, from: Date) {
    return await prisma.stockCorrection.findMany({
      where: { connectionId, correctedAt: { gte: from } },
      select: { title: true, theirs: true, ours: true, correctedAt: true },
      orderBy: { correctedAt: "desc" },
      take: 50,
    });
  },
};
