import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

type NoticeDb = Pick<typeof prisma, "notice">;

/** The Notice table's one repository (Invariant 5, order-fulfilment D8). */
export class NoticeRepository {
  /**
   * Insert the notice unless (parcel, kind, audience, ref) already has one. Answers the row only when
   * this call wrote it, which is what lets the caller enqueue a send for a new notice and nothing else.
   */
  async insertOnce(data: Prisma.NoticeCreateManyInput, tx: NoticeDb): Promise<{ id: string } | null> {
    const [row] = await tx.notice.createManyAndReturn({ data: [data], skipDuplicates: true, select: { id: true } });
    return row ?? null;
  }

  async findById(id: string) {
    return prisma.notice.findUnique({ where: { id } });
  }

  /** Claim the send: conditional, so two deliveries of one job cannot both record it. */
  async markSent(id: string): Promise<boolean> {
    const { count } = await prisma.notice.updateMany({ where: { id, sentAt: null }, data: { sentAt: new Date() } });
    return count === 1;
  }

  /** The nudges each parcel has had, for the admin's not-packed list. */
  async listKindsFor(shipmentIds: string[]) {
    if (shipmentIds.length === 0) return [];
    return prisma.notice.findMany({
      where: { shipmentId: { in: shipmentIds } },
      select: { shipmentId: true, kind: true, createdAt: true },
    });
  }
}

export const noticeRepository = new NoticeRepository();
