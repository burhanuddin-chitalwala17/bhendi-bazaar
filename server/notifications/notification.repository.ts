import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { DELIVERY_CHANNEL, DELIVERY_STATE, type DeliveryState } from "./notification.types";

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

  /** Badge items whose subject no longer needs the shop leave the list (D3). */
  async supersedeBadges(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await prisma.delivery.updateMany({
      where: { id: { in: ids }, state: DELIVERY_STATE.PENDING },
      data: { state: DELIVERY_STATE.SUPERSEDED, at: new Date() },
    });
    return count;
  }
}

export const notificationRepository = new NotificationRepository();
