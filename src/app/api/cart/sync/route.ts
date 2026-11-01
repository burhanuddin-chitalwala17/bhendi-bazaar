// src/app/api/cart/sync/route.ts

import { optionalActiveSession } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { NextRequest, NextResponse } from "next/server";
import { cartService } from "@server/cart/cart.service";
import { updateCartSchema, validateRequest } from "@/lib/validation";
import { limitRequest } from "@/lib/rate-limit";

/**
 * POST /api/cart/sync
 * Merge local cart with server cart on login
 */
export async function POST(request: NextRequest) {
  try {
    const session = await optionalActiveSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await limitRequest(request, "POST /api/cart/sync", { userId: session.user.id });
    if (rateLimitResult) return rateLimitResult;

    const validation = await validateRequest(request, updateCartSchema);
    if ("error" in validation) {
      return validation.error;
    }

    // Only the buyer's choice is read from each line (CartLineInput); the rest of
    // the payload is display baggage the server re-derives from the product.
    const merged = await cartService.syncCart(
      session.user.id,
      validation.data.items,
    );

    return NextResponse.json(merged, { status: 200 });
  } catch (error) {
    console.error("[API] POST /api/cart/sync failed:", error);
    return toErrorResponse(error, "Could not sync the cart");
  }
}
