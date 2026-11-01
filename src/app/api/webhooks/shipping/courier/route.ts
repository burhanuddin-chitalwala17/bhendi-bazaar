/**
 * Shiprocket Webhook Handler
 * POST /api/webhooks/shipping/courier
 *
 * Not named for the carrier: Shiprocket refuses a webhook URL containing "shiprocket", "kartrocket",
 * "sr" or "kr" (its webhook settings page).
 *
 * Receives tracking updates from Shiprocket and updates order status.
 */

import { NextRequest, NextResponse } from "next/server";
import { shippingOrchestrator } from "@server/shipping";
import { applyProviderStatus } from "@server/shipping/shipment-status.service";
import { trackingService } from "@server/shipping/tracking.service";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { orderService } from "@server/checkout/order.service";
import { shiprocketWebhookSchema } from "@/lib/validation/schemas/webhook.schema";
import { isShiprocketWebhookAuthentic } from "@server/shipping/webhook-auth";

export async function POST(request: NextRequest) {
  // Before the body is read: a request without the dashboard's token is a stranger's, and a
  // forged "delivered" would release a payout. 401 rather than 2xx, so a misconfigured token
  // shows in Shiprocket's delivery log instead of passing silently.
  if (!isShiprocketWebhookAuthentic(request.headers.get("x-api-key"))) {
    console.error("[shiprocket webhook] refused: missing or wrong x-api-key (SHIPROCKET_WEBHOOK_TOKEN)");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parsed before anything reads it (Invariant 4).
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

    // One writer owns the column (shipment-lifecycle D12): it maps the courier's wording, refuses
    // a move the transition table does not allow — a retried or late webhook naming a state we
    // have passed is the common case, not a fault — and keeps the raw wording either way.
    const outcome = await applyProviderStatus(
      shipment.id,
      provider.code,
      webhookEvent.status.providerStatus ?? webhookEvent.status.status,
    );

    // Derived, never written beside the parcels (D10): an order is delivered when every parcel is.
    if (
      outcome.kind === "moved" &&
      outcome.to === SHIPMENT_STATUS.DELIVERED &&
      (await trackingService.allShipmentsDelivered(shipment.orderId))
    ) {
      await orderService.markDelivered(shipment.orderId);
    }

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
