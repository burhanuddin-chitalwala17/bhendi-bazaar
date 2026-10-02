import type { Prisma } from "@prisma/client";

import { shipmentRepository } from "@server/shipping/repositories/shipment.repository";
import { shippingProviderRepository } from "@server/shipping/repositories/provider.repository";
import { shippingEventRepository } from "@server/shipping/repositories/event.repository";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";

/** Tracking details and carrier webhooks. `Shipment.status` itself is shipment-status.service's. */
export const trackingService = {
  findShipmentWithOrder(shipmentId: string) {
    return shipmentRepository.findWithOrder(shipmentId);
  },

  updateTracking(
    shipmentId: string,
    tracking: { trackingNumber: string; courierName: string; trackingUrl?: string },
  ) {
    return shipmentRepository.updateTracking(shipmentId, tracking);
  },

  findShipmentByTrackingNumber(trackingNumber: string) {
    return shipmentRepository.findByTrackingNumberWithOrder(trackingNumber);
  },

  /** Read from the rows, not inferred from one event, so an out-of-order webhook cannot conclude it alone. */
  async allShipmentsDelivered(orderId: string): Promise<boolean> {
    const siblings = await shipmentRepository.listStatusesForOrder(orderId);
    return siblings.every((s) => s.status === SHIPMENT_STATUS.DELIVERED);
  },

  configuredProvider(code: string) {
    return shippingProviderRepository.findIdentityByCode(code);
  },

  async logWebhookReceived(event: {
    orderId: string;
    shipmentId: string;
    providerId: string;
    response: Prisma.InputJsonValue;
    metadata: Prisma.InputJsonValue;
  }): Promise<void> {
    await shippingEventRepository.create({
      order: { connect: { id: event.orderId } },
      shipment: { connect: { id: event.shipmentId } },
      provider: { connect: { id: event.providerId } },
      eventType: "webhook_received",
      status: "success",
      response: event.response,
      metadata: event.metadata,
    });
  },
};
