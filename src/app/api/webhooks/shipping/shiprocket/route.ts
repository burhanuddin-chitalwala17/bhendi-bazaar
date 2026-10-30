/**
 * Shiprocket Webhook Handler
 * POST /api/webhooks/shipping/shiprocket
 *
 * Receives tracking updates from Shiprocket and updates order status.
 */

import { NextRequest, NextResponse } from "next/server";
import { shippingOrchestrator } from "@server/shipping";
import { readCourierStatus } from "@server/shipping/shipment-status.service";
import { trackingService } from "@server/shipping/tracking.service";
import { PARCEL_ACTOR } from "@server/shipping/domain/shipping.types";
import { moveParcel } from "@server/checkout/fulfilment.service";
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
    const provider = await trackingService.configuredProvider("shiprocket");

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
    const shipment = await trackingService.findShipmentByTrackingNumber(webhookEvent.trackingNumber);

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

    // One guarded move (order-fulfilment D2): mapped from the courier's wording, refused by the
    // transition table when stale, and the order's status re-derived in the same transaction (D4).
    const reading = await readCourierStatus(
      shipment.id,
      provider.code,
      webhookEvent.status.providerStatus ?? webhookEvent.status.status,
    );
    const outcome =
      reading.kind === "mapped"
        ? await moveParcel(shipment.id, reading.status, { actor: PARCEL_ACTOR.COURIER, raw: reading.raw })
        : reading;

    // Log webhook event
    await trackingService.logWebhookReceived({
      orderId: shipment.orderId,
      shipmentId: shipment.id,
      providerId: provider.id,
      response: payload,
      metadata: {
        trackingNumber: webhookEvent.trackingNumber,
        status: outcome.kind,
        providerStatus: webhookEvent.status.providerStatus,
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
