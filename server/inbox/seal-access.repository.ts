import { prisma } from "@server/shared/prisma";

/** The one writer of `SealAccess` (Invariant 5): every open of a shop's chat by someone not its member (D9). */

export interface SealAccessRow {
  id: string;
  conversationId: string;
  grantId: string;
  at: Date;
}

export const sealAccessRepository = {
  async record(input: { orgId: string; conversationId: string; grantId: string; who: string; at: Date }): Promise<void> {
    await prisma.sealAccess.create({ data: input, select: { id: true } });
  },

  /** Newest first, for "Who has opened your chats". */
  async forShop(orgId: string, take: number): Promise<SealAccessRow[]> {
    return await prisma.sealAccess.findMany({
      where: { orgId },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      select: { id: true, conversationId: true, grantId: true, at: true },
      take,
    });
  },
};
