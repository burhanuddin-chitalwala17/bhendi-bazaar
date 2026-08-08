// src/app/api/cart/sync/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { cartService } from "@server/cart/cart.service";
import { updateCartSchema, validateRequest } from "@/lib/validation";
import { withRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

/**
 * POST /api/cart/sync
 * Merge local cart with server cart on login
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Apply rate limiting: 10 syncs per minute (strict for sync operations)
    const rateLimitResult = await withRateLimit(
      request,
      { interval: 60 * 1000, uniqueTokenPerInterval: 10 },
      () => getRateLimitIdentifier(request, session.user.id)
    );
    if (rateLimitResult) return rateLimitResult;

    const validation = await validateRequest(request, updateCartSchema);
    if ("error" in validation) {
      return validation.error;
    }

    // Only the buyer's choice is read from each line (CartLineInput); the rest of
    // the payload is display baggage the server re-derives from the product.
    const merged = await cartService.syncCart(session.user.id, validation.data.items);

    return NextResponse.json(merged, { status: 200 });
  } catch (error) {
    console.error("[API] POST /api/cart/sync failed:", error);
    return NextResponse.json({ error: "Failed to sync cart" }, { status: 500 });
  }
}