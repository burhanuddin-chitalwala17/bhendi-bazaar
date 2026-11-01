import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

const ROW = {
  id: true, kind: true, provider: true, awb: true, shipmentId: true, parcelCode: true,
  courierWording: true, payload: true, dismissedAt: true, dismissedByName: true, createdAt: true,
} as const;

/** The one repository of `CourierConflict` (ADR-0003). */
export const courierConflictRepository = {
  async create(data: {
    kind: string; provider: string; awb: string; shipmentId: string | null; parcelCode: string | null;
    courierWording: string; payload: Prisma.InputJsonValue;
  }) {
    return prisma.courierConflict.create({ data, select: { id: true } });
  },

  /** Open first, then dismissed; newest first within each. */
  async list(take: number) {
    return prisma.courierConflict.findMany({
      orderBy: [{ dismissedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }, { id: "desc" }],
      take,
      select: ROW,
    });
  },

  /** Distinct AWBs, matching the list, which folds a courier's retries into one row per AWB. */
  async countOpen() {
    const awbs = await prisma.courierConflict.groupBy({ by: ["awb"], where: { dismissedAt: null } });
    return awbs.length;
  },

  async findAwb(id: string) {
    return prisma.courierConflict.findUnique({ where: { id }, select: { awb: true } });
  },

  /** Dismiss every open row for this AWB; conditional on still being open, so a second press dismisses nothing. */
  async dismissOpenForAwb(awb: string, byName: string) {
    const done = await prisma.courierConflict.updateMany({
      where: { awb, dismissedAt: null },
      data: { dismissedAt: new Date(), dismissedByName: byName },
    });
    return done.count;
  },
};
