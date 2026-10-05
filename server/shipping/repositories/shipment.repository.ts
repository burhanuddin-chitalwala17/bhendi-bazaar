import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

/** The Shipment table's repository (Invariant 5). `status` writes go through shipment-status.service. */
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
}

export const shipmentRepository = new ShipmentRepository();
