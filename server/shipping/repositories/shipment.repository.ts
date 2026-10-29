import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

/** `prisma`, or the `tx` of the transaction a caller holds. */
type ShipmentDb = Pick<typeof prisma, "shipment" | "shipmentItem">;

/**
 * The Shipment table's repository (Invariant 5). `status` is written only on
 * `shipment-status.service.ts`'s say-so — `recordTransition` is its statement, moved here so the
 * service holds no Prisma call of its own; the transition table in the service is still the guard.
 */
export class ShipmentRepository {
  async findStatus(id: string) {
    return prisma.shipment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
  }

  async findWithOrder(id: string) {
    return prisma.shipment.findUnique({
      where: { id },
      include: { order: true },
    });
  }

  async findByTrackingNumberWithOrder(trackingNumber: string) {
    return prisma.shipment.findFirst({
      where: { trackingNumber },
      include: { order: true },
    });
  }

  async listStatusesForOrder(orderId: string) {
    return prisma.shipment.findMany({
      where: { orderId },
      select: { status: true },
    });
  }

  async recordProviderWording(id: string, raw: string): Promise<void> {
    await prisma.shipment.update({
      where: { id },
      data: { shipmentStatus: raw },
    });
  }

  async updateTracking(
    id: string,
    data: { trackingNumber: string; courierName: string; trackingUrl?: string | null },
  ) {
    return prisma.shipment.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  // "confirmed"/"failed" are outside SHIPMENT_STATUS, kept as found: they belong to the
  // placeholder booking that shipping-fulfilment removes.
  async markBooked(id: string, booking: { trackingNumber?: string; trackingUrl?: string }): Promise<void> {
    await prisma.shipment.update({
      where: { id },
      data: { ...booking, status: "confirmed", updatedAt: new Date() },
    });
  }

  async markBookingFailed(id: string, shippingMeta: Prisma.InputJsonValue): Promise<void> {
    await prisma.shipment.update({
      where: { id },
      data: { status: "failed", shippingMeta, updatedAt: new Date() },
    });
  }

  /** One parcel of a new order, on the order's own transaction. The location is persisted and its address snapshotted (stock-locations D5/D6). */
  async createForOrder(data: Prisma.ShipmentUncheckedCreateInput, tx: ShipmentDb) {
    return await tx.shipment.create({ data });
  }

  /** The parcels' lines, one statement, on the order's transaction. */
  async createItemsForOrder(rows: Prisma.ShipmentItemCreateManyInput[], tx: ShipmentDb): Promise<void> {
    if (rows.length) await tx.shipmentItem.createMany({ data: rows });
  }

  /**
   * Claim the one restock a parcel gets. Conditional (ADR-0007): a courier repeating a terminal
   * event finds `false` and credits nothing. Read-then-write would be a race, not a check.
   */
  async claimRestock(id: string, tx: ShipmentDb): Promise<boolean> {
    const claimed = await tx.shipment.updateMany({
      where: { id, restockedAt: null },
      data: { restockedAt: new Date() },
    });
    return claimed.count === 1;
  }

  /** The status move `shipment-status.service.ts` decided, with the courier's wording and the delivery stamp. */
  async recordTransition(
    id: string,
    data: { status: string; shipmentStatus?: string; deliveredAt?: Date },
    tx: ShipmentDb,
  ): Promise<void> {
    await tx.shipment.update({ where: { id }, data });
  }

  /** The parcel's org, order and units: what payouts reverses when it fails (offers-hardening D1). */
  async reversalScope(id: string, tx: ShipmentDb) {
    return await tx.shipment.findUnique({
      where: { id },
      select: {
        orgId: true,
        orderId: true,
        items: { select: { orderItemId: true, quantity: true } },
      },
    });
  }
}

export const shipmentRepository = new ShipmentRepository();
