import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import type { RefundCause } from "@server/payments/refund.types";

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

  async forOrder(orderId: string, db: RefundDb = prisma) {
    return await db.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      select: { shipmentId: true, amountPaise: true, state: true, startedAt: true },
    });
  }
}

export const refundRepository = new RefundRepository();
