/**
 * Stock Check API Route
 * POST /api/products/check-stock - Check stock availability for multiple items
 */

import { NextRequest, NextResponse } from "next/server";
import { limitRequest } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { toErrorResponse } from "@/lib/api-error-response";
import { productService } from "@server/catalog/product.service";
import { validateRequest } from "@/lib/validation";
import { stockCheckSchema } from "@/lib/validation/schemas/cart.schemas";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const limited = await limitRequest(request, "POST /api/products/check-stock", { userId: session?.user?.id });
    if (limited) return limited;
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
    const { products, stockRows } = await productService.listForStockCheck(ids);
    const totals = new Map<string, number>();
    for (const row of stockRows) {
      totals.set(
        row.productId,
        (totals.get(row.productId) ?? 0) + row.quantity,
      );
    }
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const stockStatus = validation.data.items.map((item) => {
      const product = productsById.get(item.productId);
      const stock = totals.get(item.productId) ?? 0;
      if (!product) {
        return {
          productId: item.productId,
          name: "Unknown product",
          available: false,
          stock: 0,
        };
      }
      // An archived product is never available, whatever is on the shelf: its stock
      // is real but not for sale (product-archive R5). The cart already renders this
      // state, so withdrawal reuses it rather than adding a second one.
      if (product.archivedAt) {
        return {
          productId: item.productId,
          name: product.name,
          available: false,
          stock: 0,
        };
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
    return toErrorResponse(error, "Could not check stock");
  }
}
