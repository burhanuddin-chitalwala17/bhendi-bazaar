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
    // One availability figure per product: the sum across ACTIVE locations
    // (stock-locations R4/R11). The response never carries a per-location figure —
    // what reaches the browser has been disclosed whether or not it is displayed (A9).
    const ids = validation.data.items.map((item) => item.productId);
    const [products, stockRows] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
      prisma.productStock.findMany({
        where: { productId: { in: ids }, orgAddress: { isActive: true } },
        select: { productId: true, quantity: true },
      }),
    ]);
    const totals = new Map<string, number>();
    for (const row of stockRows) {
      totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantity);
    }
    const productsById = new Map(products.map((product) => [product.id, product]));
    const stockStatus = validation.data.items.map((item) => {
      const product = productsById.get(item.productId);
      const stock = totals.get(item.productId) ?? 0;
      if (!product) {
        return { productId: item.productId, name: "Unknown product", available: false, stock: 0 };
      }
      return {
        productId: item.productId,
        name: product.name,
        available: stock >= item.quantity,
        stock,
      };
    });

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
