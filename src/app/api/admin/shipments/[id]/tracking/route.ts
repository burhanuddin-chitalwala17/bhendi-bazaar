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
import { z } from "zod";
import { verifyAdminSession } from "@/lib/admin-auth";
const updateTrackingSchema = z.object({
  trackingNumber: z.string().min(5, "AWB/Tracking number is required"),
  courierName: z.string().min(2, "Courier name is required"),
  trackingUrl: z.string().url("Invalid tracking URL").optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const session = await verifyAdminSession();
    if (session instanceof NextResponse) return session;    


    const { id: shipmentId } = await params;
    
    if (!shipmentId) {
      return NextResponse.json(
        { error: "Shipment ID is required" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateTrackingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: validation.error.message 
        },
        { status: 400 }
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
        { status: 404 }
      );
    }

    // Update shipment with tracking details
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingNumber,
        courierName,
        trackingUrl,
        status: "shipped", // Mark as shipped once tracking is added
        updatedAt: new Date(),
      },
    });

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
    console.error("Failed to update shipment tracking:", error);
    
    return NextResponse.json(
      {
        error: error instanceof Error 
          ? error.message 
          : "Failed to update tracking",
      },
      { status: 500 }
    );
  }
}
