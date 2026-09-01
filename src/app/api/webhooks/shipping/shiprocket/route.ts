/**
 * Shiprocket Webhook Handler
 * POST /api/webhooks/shipping/shiprocket
 * 
 * Receives tracking updates from Shiprocket and updates order status.
 */

import { NextRequest, NextResponse } from "next/server";
import { shippingOrchestrator } from "@server/shipping";
import { prisma } from "@server/shared/prisma";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

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
        { status: 500 }
      );
    }

    // Process webhook
    const webhookEvent = await shippingOrchestrator.handleWebhook(
      provider.code,
      payload
    );

    // Find shipment by tracking number
    const shipment = await prisma.shipment.findFirst({
      where: { trackingNumber: webhookEvent.trackingNumber },
      include: { order: true },
    });

    if (!shipment) {
      console.warn(`Shipment not found for tracking number: ${webhookEvent.trackingNumber}`);
      // Still return 200 to acknowledge webhook
      return NextResponse.json({ success: true, message: "Shipment not found" });
    }

    // Update shipment status
    const updateData: any = {
      status: webhookEvent.status.status,
      updatedAt: new Date(),
    };

    // If delivered, mark as delivered
    if (webhookEvent.status.status === "delivered") {
      updateData.deliveredAt = webhookEvent.status.timestamp;
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: updateData,
    });

    // Check if all shipments for this order are delivered
    const allShipments = await prisma.shipment.findMany({
      where: { orderId: shipment.orderId },
    });

    const allDelivered = allShipments.every(s => s.status === "delivered");

    // If all shipments delivered, update order status
    if (allDelivered) {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: "delivered" },
      });
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
          status: webhookEvent.status.status,
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

    console.log(`✓ Webhook processed for shipment ${shipment.code} (order ${shipment.order.code})`);

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
      { status: 200 }
    );
  }
}

