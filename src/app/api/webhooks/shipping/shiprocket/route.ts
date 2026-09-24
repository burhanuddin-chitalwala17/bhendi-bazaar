/**
 * Shiprocket Webhook Handler
 * POST /api/webhooks/shipping/shiprocket
 *
 * Receives tracking updates from Shiprocket and updates order status.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { shippingOrchestrator } from "@server/shipping";
import { prisma } from "@server/shared/prisma";
import { applyProviderStatus } from "@server/shipping/shipment-status.service";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { ORDER_STATUS } from "@server/checkout/order.types";
import { shiprocketWebhookSchema } from "@/lib/validation/schemas/webhook.schema";

export async function POST(request: NextRequest) {
  try {
    // Parsed before anything reads it (Invariant 4). The adapter behind this used `as` on the
    // body and dereferenced `awb` and `shipment_status` off whatever arrived; with no signature
    // check on this route yet, that made an unauthenticated stranger's JSON the input to a
    // shipment transition.
    const payload = shiprocketWebhookSchema.parse(await request.json());

    console.log("Shiprocket webhook received:", payload);

    // Confirm the carrier is configured before trusting the payload
    const provider = await prisma.shippingProvider.findUnique({
      where: { code: "shiprocket" },
      select: { id: true, code: true },
    });

    if (!provider) {
      console.error("Shiprocket provider not found in database");
      return NextResponse.json(
        { success: false, error: "Provider not configured" },
        { status: 500 },
      );
    }

    // Process webhook
    const webhookEvent = await shippingOrchestrator.handleWebhook(
      provider.code,
      payload,
    );

    // Find shipment by tracking number
    const shipment = await prisma.shipment.findFirst({
      where: { trackingNumber: webhookEvent.trackingNumber },
      include: { order: true },
    });

    if (!shipment) {
      console.warn(
        `Shipment not found for tracking number: ${webhookEvent.trackingNumber}`,
      );
      // Still return 200 to acknowledge webhook
      return NextResponse.json({
        success: true,
        message: "Shipment not found",
      });
    }

    // One writer owns the column (shipment-lifecycle D12): it maps the courier's wording, refuses
    // a move the transition table does not allow — a retried or late webhook naming a state we
    // have passed is the common case, not a fault — and keeps the raw wording either way.
    const outcome = await applyProviderStatus(
      shipment.id,
      provider.code,
      webhookEvent.status.providerStatus ?? webhookEvent.status.status,
    );

    // Derived, never written beside the parcels (D10): an order is delivered when every parcel
    // is. Recomputed from the rows rather than inferred from this one event, so a webhook
    // arriving out of order cannot conclude it alone.
    if (outcome.kind === "moved" && outcome.to === SHIPMENT_STATUS.DELIVERED) {
      const siblings = await prisma.shipment.findMany({
        where: { orderId: shipment.orderId },
        select: { status: true },
      });
      if (siblings.every((s) => s.status === SHIPMENT_STATUS.DELIVERED)) {
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: { status: ORDER_STATUS.DELIVERED },
        });
      }
    }

    // Log webhook event
    await prisma.shippingEvent.create({
      data: {
        order: {
          connect: { id: shipment.orderId },
        },
        shipment: {
          connect: { id: shipment.id },
        },
        provider: {
          connect: { id: provider.id },
        },
        eventType: "webhook_received",
        status: "success",
        response: payload,
        metadata: {
          trackingNumber: webhookEvent.trackingNumber,
          status: outcome.kind,
          providerStatus: webhookEvent.status.providerStatus,
        },
      },
    });

    // TODO: Send customer notification (email/SMS) based on status
    // if (webhookEvent.status.status === 'out_for_delivery') {
    //   await sendOutForDeliveryNotification(shipment.order);
    // }
    // if (webhookEvent.status.status === 'delivered') {
    //   await sendDeliveredNotification(shipment.order);
    // }

    console.log(
      `✓ Webhook processed for shipment ${shipment.code} (order ${shipment.order.code})`,
    );

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      orderCode: shipment.order.code,
      shipmentCode: shipment.code,
      status: webhookEvent.status.status,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    // Log the error to console (can't create ShippingEvent without valid shipment)
    console.error("Failed to process webhook:", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    // Always return 200 to prevent webhook retries
    return NextResponse.json(
      {
        success: false,
        error: "Webhook processing failed",
      },
      { status: 200 },
    );
  }
}
