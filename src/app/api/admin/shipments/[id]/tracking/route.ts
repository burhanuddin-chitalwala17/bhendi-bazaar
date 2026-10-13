/**
 * Admin API: Update Shipment Tracking
 *
 * PATCH /api/admin/shipments/[id]/tracking
 *
 * Allows admin to manually update shipment tracking details
 * after creating the shipment on Shiprocket website
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { applyStatus } from "@server/shipping/shipment-status.service";
import { trackingService } from "@server/shipping/tracking.service";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { updateTrackingSchema } from "@/lib/validation/schemas/shipment-tracking.schema";
import { ORDER_STATUS } from "@server/checkout/order.types";

/** A courier is booked once the org has packed; before that there is no parcel to track. */
const TRACKABLE = new Set<string>([ORDER_STATUS.PACKED, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify admin access
    const session = await requirePlatformAdmin();

    const { id: shipmentId } = await params;

    if (!shipmentId) {
      return NextResponse.json(
        { error: "Shipment ID is required" },
        { status: 400 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateTrackingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.message,
        },
        { status: 400 },
      );
    }

    const { trackingNumber, courierName, trackingUrl } = validation.data;

    const shipment = await trackingService.findShipmentWithOrder(shipmentId);

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }

    if (!TRACKABLE.has(shipment.order?.status ?? "")) {
      return NextResponse.json(
        { error: "Tracking can only be added after the org marks the order as packed" },
        { status: 400 },
      );
    }

    const updatedShipment = await trackingService.updateTracking(shipmentId, {
      trackingNumber,
      courierName,
      trackingUrl,
    });

    try {
      await applyStatus(shipmentId, SHIPMENT_STATUS.PICKED_UP);
    } catch {
      // Status transition may fail if shipment is already past packing — tracking is saved regardless
    }

    return NextResponse.json({
      success: true,
      message: "Tracking updated successfully",
      shipment: {
        id: updatedShipment.id,
        code: updatedShipment.code,
        trackingNumber: updatedShipment.trackingNumber,
        courierName: updatedShipment.courierName,
        trackingUrl: updatedShipment.trackingUrl,
        status: updatedShipment.status,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not update shipment tracking:");
  }
}
