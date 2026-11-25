import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import type { TouchChannel, TouchCounts } from "./campaigns.types";

type Db = Prisma.TransactionClient | typeof prisma;

/** The one way to reach `MarketingTouch` (ADR-0003; A-D13). */
export const marketingTouchRepository = {
  /** Serialises one buyer's sends from one shop, so the count and the insert cannot race (A-D13). */
  async lock(tx: Prisma.TransactionClient, orgId: string, contactId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`touch:${orgId}`}), hashtext(${contactId}))`;
  },

  async counts(orgId: string, contactId: string, since: { dayStart: Date; weekStart: Date }, db: Db = prisma): Promise<TouchCounts> {
    const [today, week] = await Promise.all([
      db.marketingTouch.count({ where: { orgId, contactId, at: { gte: since.dayStart } } }),
      db.marketingTouch.count({ where: { orgId, contactId, at: { gte: since.weekStart } } }),
    ]);
    return { today, week };
  },

  /** Call under `lock`, in the transaction that queued the send. */
  async record(tx: Prisma.TransactionClient, touch: { orgId: string; contactId: string; channel: TouchChannel; sourceRef: string; at: Date }): Promise<void> {
    await tx.marketingTouch.create({ data: touch, select: { id: true } });
  },
};
