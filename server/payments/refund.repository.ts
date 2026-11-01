import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { REFUND_STATE, REFUND_STARTABLE, type RefundCause } from "@server/payments/refund.types";

const ADMIN_ROW = {
  id: true, orderId: true, shipmentId: true, amountPaise: true, cause: true, state: true,
  gatewayRefundId: true, failureReason: true, requestedAt: true, createdAt: true, startedAt: true,
} as const;

/** Not yet started at the gateway: what the admin still has to act on. */
const NOT_STARTED = { state: { not: REFUND_STATE.STARTED } } as const;

type RefundDb = Pick<typeof prisma, "refund">;

/** The Refund table's one repository (Invariant 5, order-fulfilment D16). */
export class RefundRepository {
  /**
   * Write the one refund a parcel is owed. Its unique `shipmentId` is the backstop: a repeated
   * cancel, or a cancel and a later loss, writes nothing. Answers whether this call wrote it.
   */
  async recordOwed(
    row: { orderId: string; shipmentId: string; cause: RefundCause; amountPaise: number },
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const written = await tx.refund.createMany({ data: [row], skipDuplicates: true });
    return written.count === 1;
  }

  /** What the order's refunds already add up to, in every state: the cap's other half (Q11). */
  async owedSoFar(orderId: string, tx: RefundDb): Promise<number> {
    const sum = await tx.refund.aggregate({ where: { orderId }, _sum: { amountPaise: true } });
    return sum._sum.amountPaise ?? 0;
  }

  async findById(id: string) {
    return await prisma.refund.findUnique({ where: { id }, select: { ...ADMIN_ROW } });
  }

  /**
   * Take the row for one gateway request (D17): OWED, UNCONFIRMED or FAILED, or REQUESTED whose
   * answer never came by `staleBefore`. Conditional, so of two presses exactly one wins.
   */
  async claim(id: string, now: Date, staleBefore: Date): Promise<boolean> {
    const taken = await prisma.refund.updateMany({
      where: {
        id,
        OR: [{ state: { in: [...REFUND_STARTABLE] } }, { state: REFUND_STATE.REQUESTED, requestedAt: { lt: staleBefore } }],
      },
      data: { state: REFUND_STATE.REQUESTED, requestedAt: now, failureReason: null },
    });
    return taken.count === 1;
  }

  /** The gateway answered for the request this claim made; a later claim's answer is not this one's. */
  async settle(
    id: string,
    requestedAt: Date,
    data: { state: typeof REFUND_STATE.STARTED; gatewayRefundId: string; startedAt: Date } | { state: typeof REFUND_STATE.FAILED; failureReason: string } | { state: typeof REFUND_STATE.UNCONFIRMED },
    tx: RefundDb = prisma,
  ): Promise<boolean> {
    const settled = await tx.refund.updateMany({ where: { id, state: REFUND_STATE.REQUESTED, requestedAt }, data });
    return settled.count === 1;
  }

  /** The admin's list: not started first, oldest first; then started, newest first (ux.md "admin refunds"). */
  async listForAdmin(page: { skip: number; take: number }) {
    const open = await prisma.refund.count({ where: NOT_STARTED });
    const fromOpen =
      page.skip < open
        ? await prisma.refund.findMany({ where: NOT_STARTED, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: page.skip, take: page.take, select: ADMIN_ROW })
        : [];
    const left = page.take - fromOpen.length;
    const fromStarted =
      left > 0
        ? await prisma.refund.findMany({
            where: { state: REFUND_STATE.STARTED },
            orderBy: [{ startedAt: "desc" }, { id: "asc" }],
            skip: Math.max(0, page.skip - open),
            take: left,
            select: ADMIN_ROW,
          })
        : [];
    return [...fromOpen, ...fromStarted];
  }

  async countAll(): Promise<{ all: number; notStarted: number }> {
    const [all, notStarted] = await Promise.all([prisma.refund.count(), prisma.refund.count({ where: NOT_STARTED })]);
    return { all, notStarted };
  }

  async forOrder(orderId: string, db: RefundDb = prisma) {
    return await db.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      select: { shipmentId: true, amountPaise: true, state: true, startedAt: true },
    });
  }
}

export const refundRepository = new RefundRepository();
