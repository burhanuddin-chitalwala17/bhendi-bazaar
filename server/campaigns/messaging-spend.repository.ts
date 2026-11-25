import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** The one way to reach `MessagingSpend` (ADR-0003; A-D13). */
export const messagingSpendRepository = {
  /**
   * Reserves `costPaise` for this month, only if spent + reserved + cost stays within the limit
   * (null: no limit). One conditional statement, so two senders at the limit cannot both pass.
   */
  async reserve(tx: Prisma.TransactionClient, orgId: string, month: string, costPaise: number, limitPaise: number | null): Promise<boolean> {
    // Prisma's upsert is a SELECT then INSERT, so a month's first burst would race on the key.
    await tx.$executeRaw`INSERT INTO "MessagingSpend" ("orgId", "month") VALUES (${orgId}, ${month}) ON CONFLICT DO NOTHING`;
    const count = await tx.$executeRaw`
      UPDATE "MessagingSpend" SET "reservedPaise" = "reservedPaise" + ${costPaise}
      WHERE "orgId" = ${orgId} AND "month" = ${month}
        AND (${limitPaise}::int IS NULL OR "spentPaise" + "reservedPaise" + ${costPaise} <= ${limitPaise}::int)`;
    return count === 1;
  },

  /** True for the first caller in the month only: the shop is told once (D4). */
  async claimLimitNotice(tx: Prisma.TransactionClient, orgId: string, month: string): Promise<boolean> {
    const { count } = await tx.messagingSpend.updateMany({
      where: { orgId, month, limitNoticeAt: null },
      data: { limitNoticeAt: new Date() },
    });
    return count === 1;
  },

  async forMonth(orgId: string, month: string, db: Db = prisma) {
    return db.messagingSpend.findUnique({
      where: { orgId_month: { orgId, month } },
      select: { reservedPaise: true, spentPaise: true },
    });
  },
};
