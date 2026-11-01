// src/app/api/cart/route.ts

import { optionalActiveSession } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { cartService } from "@server/cart/cart.service";
import { validateRequest } from "@/lib/validation";
import { updateCartSchema } from "@/lib/validation/schemas/cart.schemas";
import { limitRequest } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-error-response";

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
    const session = await optionalActiveSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await limitRequest(request, "PUT /api/cart", { userId: session.user.id });
    if (rateLimitResult) return rateLimitResult;

    // Validate request body
    const validation = await validateRequest(request, updateCartSchema);

    if ("error" in validation) {
      return validation.error;
    }

    const { version } = await cartService.updateCart(
      session.user.id,
      validation.data.items,
      validation.data.version,
    );

    return NextResponse.json({ success: true, version }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not update the cart");
  }
}

/**
 * DELETE /api/cart
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await optionalActiveSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await limitRequest(request, "DELETE /api/cart", { userId: session.user.id });
    if (rateLimitResult) return rateLimitResult;

    await cartService.clearCart(session.user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not clear the cart");
  }
}
