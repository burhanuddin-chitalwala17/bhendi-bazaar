import type { Prisma } from "@prisma/client";

import { shipmentRepository } from "@server/shipping/repositories/shipment.repository";
import { shippingProviderRepository } from "@server/shipping/repositories/provider.repository";
import { shippingEventRepository } from "@server/shipping/repositories/event.repository";

/** Tracking details and carrier webhooks. `Shipment.status` itself is shipment-status.service's. */
export const trackingService = {
  findShipmentByTrackingNumber(trackingNumber: string) {
    return shipmentRepository.findByTrackingNumberWithOrder(trackingNumber);
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
