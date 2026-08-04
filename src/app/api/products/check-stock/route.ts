/**
 * Stock Check API Route
 * POST /api/products/check-stock - Check stock availability for multiple items
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@server/shared/prisma";
import { validateRequest } from "@/lib/validation";
import { stockCheckSchema } from "@/lib/validation/schemas/cart.schemas";

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, stockCheckSchema);

    if ("error" in validation) {
      return validation.error;
    }

    const { items } = validation.data;

    // Check stock for each item
    const stockStatus = await Promise.all(
      items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, stock: true },
        });

        if (!product) {
          return {
            productId: item.productId,
            available: false,
            stock: 0,
            requested: item.quantity,
            error: "Product not found",
          };
        }

        return {
          productId: item.productId,
          name: product.name,
          available: product.stock >= item.quantity,
          stock: product.stock,
          requested: item.quantity,
        };
      })
    );

    const allAvailable = stockStatus.every((s) => s.available);

    return NextResponse.json({
      available: allAvailable,
      items: stockStatus,
    });
  } catch (error) {
    console.error("Stock check failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check stock",
      },
      { status: 500 }
    );
  }
}
