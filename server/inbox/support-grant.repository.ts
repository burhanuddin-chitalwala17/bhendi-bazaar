import { prisma } from "@server/shared/prisma";

/** The one writer of `SupportGrant` (Invariant 5): a shop sharing one chat with support for one request (D9). */

export interface LiveGrant {
  id: string;
  orgId: string;
  conversationId: string;
  requestId: string;
  expiresAt: Date;
}

const LIVE = { id: true, orgId: true, conversationId: true, requestId: true, expiresAt: true } as const;

export const supportGrantRepository = {
  async create(input: { orgId: string; conversationId: string; requestId: string; grantedById: string; expiresAt: Date }): Promise<LiveGrant> {
    return await prisma.supportGrant.create({ data: input, select: LIVE });
  },

  /** Stop sharing: every live share of the thread ends now. Answers how many. */
  async revoke(orgId: string, conversationId: string, now: Date): Promise<number> {
    const { count } = await prisma.supportGrant.updateMany({
      where: { orgId, conversationId, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    return count;
  },

  /** The share that lasts longest, while one is live. */
  async live(conversationId: string, now: Date): Promise<LiveGrant | null> {
    return await prisma.supportGrant.findFirst({
      where: { conversationId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
      select: LIVE,
    });
  },

  async liveForShop(orgId: string, now: Date, take: number): Promise<LiveGrant[]> {
    return await prisma.supportGrant.findMany({
      where: { orgId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
      select: LIVE,
      take,
    });
  },
};
