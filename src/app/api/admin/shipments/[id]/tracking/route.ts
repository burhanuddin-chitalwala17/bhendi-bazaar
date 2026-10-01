/**
 * Admin API: Update Shipment Tracking
 *
 * PATCH /api/admin/shipments/[id]/tracking
 *
 * Allows admin to manually update shipment tracking details
 * after creating the shipment on Shiprocket website
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@server/shared/prisma";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { applyStatus } from "@server/shipping/shipment-status.service";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { updateTrackingSchema } from "@/lib/validation/schemas/shipment-tracking.schema";

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

    // Check if shipment exists
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }

    // Update shipment with tracking details
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: { trackingNumber, courierName, trackingUrl, updatedAt: new Date() },
    });

    // An AWB means the courier has it. The status moves through the one writer that owns the
    // column, so the transition table decides whether the move is legal — it used to be the
    // literal `"shipped"`, a value `ShipmentStatus` did not contain (shipment-lifecycle D12).
    await applyStatus(shipmentId, SHIPMENT_STATUS.PICKED_UP);

    // Log the update
    console.log(`✅ Tracking updated for shipment ${shipment.code}`);
    console.log(`   AWB: ${trackingNumber}`);
    console.log(`   Courier: ${courierName}`);
    console.log(`   Updated by: ${session.user.email}`);

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
