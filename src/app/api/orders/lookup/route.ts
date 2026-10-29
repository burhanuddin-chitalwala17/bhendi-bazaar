/**
 * Order Lookup API Route
 *
 * POST /api/orders/lookup - Lookup order by code (for guest orders)
 */

import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error-response";
import { orderService } from "@server/checkout/order.service";
import { limitRequest } from "@/lib/rate-limit";
import { validateRequest } from "@/lib/validation";
import { orderLookupSchema } from "@/lib/validation/schemas/order.schemas";

export async function POST(request: NextRequest) {
  const limited = await limitRequest(request, "POST /api/orders/lookup");
  if (limited) return limited;

  // Validate request body
  const validation = await validateRequest(request, orderLookupSchema);

  if ("error" in validation) {
    return validation.error;
  }

  const { code } = validation.data;

  try {
    const order = await orderService.lookupOrderByCode(code);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return toErrorResponse(error, "Could not look up that order");
  }
}
