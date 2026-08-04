// src/app/api/cart/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { cartService } from "@server/cart/cart.service";
import { validateRequest } from "@/lib/validation";
import { updateCartSchema } from "@/lib/validation/schemas/cart.schemas";
import { withRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import type { CartItem } from "@/domain/cart";

/**
 * API Routes act as the bridge between client and server
 * They can import from both sides to translate between them
 */

/**
 * PUT /api/cart
 * Replace entire cart with new items
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Apply rate limiting: 100 requests per minute
    const rateLimitResult = await withRateLimit(
      request,
      { interval: 60 * 1000, uniqueTokenPerInterval: 100 },
      () => getRateLimitIdentifier(request, session.user.id)
    );
    if (rateLimitResult) return rateLimitResult;

    // Validate request body
    const validation = await validateRequest(request, updateCartSchema);

    if ("error" in validation) {
      return validation.error;
    }

    // Transform items: convert null to undefined for salePrice
    const items = validation.data.items.map((item) => ({
      ...item,
      salePrice: item.salePrice ?? undefined,
    })) as CartItem[];

    // Call server service (types converted at runtime)
    await cartService.updateCart(session.user.id, items);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[API] PUT /api/cart failed:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to update cart";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/cart
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Apply rate limiting: 20 requests per minute
    const rateLimitResult = await withRateLimit(
      request,
      { interval: 60 * 1000, uniqueTokenPerInterval: 20 },
      () => getRateLimitIdentifier(request, session.user.id)
    );
    if (rateLimitResult) return rateLimitResult;

    await cartService.clearCart(session.user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[API] DELETE /api/cart failed:", error);
    return NextResponse.json(
      { error: "Failed to clear cart" },
      { status: 500 }
    );
  }
}