/**
 * GET /api/orders/[id]/shipping
 * 
 * Get shipping details for a specific order
 * Returns all shipments for the order with tracking information
 */

import { NextResponse } from "next/server";
import { prisma } from "@server/shared/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch order with all its shipments
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        shippingTotal: true,
        shipments: {
          select: {
            id: true,
            code: true,
            items: true,
            sellerId: true,
            fromPincode: true,
            fromCity: true,
            fromState: true,
            shippingCost: true,
            shippingProviderId: true,
            shippingProvider: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            trackingNumber: true,
            courierName: true,
            trackingUrl: true,
            packageWeight: true,
            status: true,
            estimatedDelivery: true,
            shippingMeta: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      shipping: {
        orderId: order.id,
        orderCode: order.code,
        orderStatus: order.status,
        totalShippingCost: order.shippingTotal,
        shipments: order.shipments.map((shipment) => ({
          id: shipment.id,
          code: shipment.code,
          items: shipment.items,
          origin: {
            sellerId: shipment.sellerId,
            pincode: shipment.fromPincode,
            city: shipment.fromCity,
            state: shipment.fromState,
          },
          shipping: {
            cost: shipment.shippingCost,
            weight: shipment.packageWeight,
            providerId: shipment.shippingProviderId,
            providerName: shipment.shippingProvider?.name,
            providerCode: shipment.shippingProvider?.code,
          },
          tracking: {
            number: shipment.trackingNumber,
            courier: shipment.courierName,
            url: shipment.trackingUrl,
            status: shipment.status,
            estimatedDelivery: shipment.estimatedDelivery,
          },
          meta: shipment.shippingMeta,
          createdAt: shipment.createdAt,
          updatedAt: shipment.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching order shipping:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shipping information" },
      { status: 500 }
    );
  }
}