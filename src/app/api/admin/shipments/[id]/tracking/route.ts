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
import { trackingService } from "@server/shipping/tracking.service";
import { PARCEL_ACTOR, SHIPMENT_STATUS, alreadyMessage } from "@server/shipping/domain/shipping.types";
import { ConflictError } from "@server/shared/domain-error";
import { updateTrackingSchema } from "@/lib/validation/schemas/shipment-tracking.schema";
import { ORDER_STATUS } from "@server/checkout/order.types";
import { moveParcel } from "@server/checkout/fulfilment.service";

/** Until unit 2's per-parcel "ready", the org's order-wide "packed" is the only signal that it is. */
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

    if (shipment.status === SHIPMENT_STATUS.PACKING && !TRACKABLE.has(shipment.order?.status ?? "")) {
      return NextResponse.json(
        { error: "Tracking can only be added after the org marks the order as packed" },
        { status: 400 },
      );
    }

    // An AWB means a pickup is booked, not that the courier came (order-fulfilment Q4). Unit 3
    // replaces this route with booking; until then it walks the parcel there through the one
    // guarded move. A courier's later event moves it on; a parcel already past is left alone.
    if (shipment.status === SHIPMENT_STATUS.PACKING) {
      await moveParcel(shipmentId, SHIPMENT_STATUS.READY_FOR_PICKUP, { actor: PARCEL_ACTOR.ADMIN, refuse: true });
    }
    // A cancelled parcel is refused (409) rather than given an AWB; one the courier already has keeps its status.
    if (shipment.status === SHIPMENT_STATUS.PACKING || shipment.status === SHIPMENT_STATUS.READY_FOR_PICKUP) {
      await moveParcel(shipmentId, SHIPMENT_STATUS.PICKUP_BOOKED, { actor: PARCEL_ACTOR.ADMIN, refuse: true });
    } else if (shipment.status === SHIPMENT_STATUS.CANCELLED) {
      throw new ConflictError(alreadyMessage(SHIPMENT_STATUS.CANCELLED));
    }

    const updatedShipment = await trackingService.updateTracking(shipmentId, {
      trackingNumber,
      courierName,
      trackingUrl,
    });

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
