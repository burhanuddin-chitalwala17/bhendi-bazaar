import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { DELIVERY_CHANNEL, DELIVERY_STATE, DELIVERY_TIMING, type DeliveryState } from "./notification.types";

type HubDb = Pick<typeof prisma, "notificationEvent" | "delivery">;

/** An event and its deliveries are one aggregate; this is the one repository of both tables (Invariant 5). */
export class NotificationRepository {
  /** Answers true only when this call wrote the event: a repeat key is the same event (R2). */
  async insertEventOnce(data: Prisma.NotificationEventCreateManyInput, tx: HubDb): Promise<boolean> {
    const rows = await tx.notificationEvent.createManyAndReturn({ data: [data], skipDuplicates: true, select: { eventKey: true } });
    return rows.length === 1;
  }

  /** Answers only the rows this call wrote, so only those are sent (hub Q3). */
  async insertDeliveries(data: Prisma.DeliveryCreateManyInput[], tx: HubDb) {
    if (data.length === 0) return [];
    return tx.delivery.createManyAndReturn({ data, skipDuplicates: true, select: { id: true, timing: true } });
  }

  async findDelivery(id: string) {
    return prisma.delivery.findUnique({
      where: { id },
      select: { id: true, recipientId: true, channel: true, state: true, event: { select: { kind: true, orgId: true, facts: true } } },
    });
  }

  /** Conditional, so a delivery already settled by a twin job is never written over. */
  async settle(id: string, from: readonly DeliveryState[], to: DeliveryState, extra: { reason?: string | null; providerId?: string | null } = {}) {
    const { count } = await prisma.delivery.updateMany({
      where: { id, state: { in: [...from] } },
      data: { state: to, at: new Date(), ...extra },
    });
    return count === 1;
  }

  private openBadges(recipientId: string, orgId: string): Prisma.DeliveryWhereInput {
    return { recipientId, channel: DELIVERY_CHANNEL.BADGE, state: DELIVERY_STATE.PENDING, event: { orgId } };
  }

  async countOpenBadges(recipientId: string, orgId: string): Promise<number> {
    return prisma.delivery.count({ where: this.openBadges(recipientId, orgId) });
  }

  async listOpenBadges(recipientId: string, orgId: string) {
    return prisma.delivery.findMany({
      where: this.openBadges(recipientId, orgId),
      orderBy: [{ at: "desc" }, { id: "desc" }],
      select: { id: true, eventKey: true, at: true, event: { select: { kind: true, facts: true } } },
    });
  }

  /** The parcel notices each parcel has had, for the admin's not-packed list (D6). */
  async listParcelKinds(shipmentIds: string[]) {
    if (shipmentIds.length === 0) return [];
    return prisma.notificationEvent.findMany({
      where: { shipmentId: { in: shipmentIds } },
      select: { shipmentId: true, kind: true, createdAt: true },
    });
  }

  /** Badge items whose subject no longer needs the shop leave the list (D3). */
  async supersedeBadges(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await prisma.delivery.updateMany({
      where: { id: { in: ids }, state: DELIVERY_STATE.PENDING },
      data: { state: DELIVERY_STATE.SUPERSEDED, at: new Date() },
    });
    return count;
  }

  /** What waits for the morning email, written before `before` (D4); the partial index answers it. */
  async listPendingDigest(before: Date) {
    return prisma.delivery.findMany({
      where: { timing: DELIVERY_TIMING.DIGEST, state: DELIVERY_STATE.PENDING, event: { createdAt: { lt: before } } },
      orderBy: [{ at: "asc" }, { id: "asc" }],
      select: { id: true, recipientId: true, at: true, event: { select: { kind: true, orgId: true, facts: true } } },
    });
  }

  /** Settle several rows at once, each only from a state it may leave, as `settle` does for one. */
  async settleMany(ids: string[], from: readonly DeliveryState[], to: DeliveryState, extra: { reason?: string | null; providerId?: string | null } = {}) {
    if (ids.length === 0) return 0;
    const { count } = await prisma.delivery.updateMany({
      where: { id: { in: ids }, state: { in: [...from] } },
      data: { state: to, at: new Date(), ...extra },
    });
    return count;
  }

  /**
   * Delete up to `batch` events written before `cutoff`, their deliveries with them (cascade), by the
   * indexed `createdAt` (Q7, social-selling D15). Answers how many events went.
   */
  async deleteEventsBefore(cutoff: Date, batch: number): Promise<number> {
    return prisma.$executeRaw`
      DELETE FROM "NotificationEvent" WHERE "eventKey" IN (
        SELECT "eventKey" FROM "NotificationEvent" WHERE "createdAt" < ${cutoff} ORDER BY "createdAt" LIMIT ${batch}
      )`;
  }
}

export const notificationRepository = new NotificationRepository();
