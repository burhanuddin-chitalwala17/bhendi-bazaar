import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { wishlistService } from "@server/wishlist/wishlist.service";
import { validateRequest, validateQueryParams } from "@/lib/validation";
import { wishlistItemSchema } from "@/lib/validation/schemas/wishlist.schema";
import { withRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-error-response";

/**
 * Saving and un-saving a product.
 *
 * The heart also checks the session before it fires, but that is a courtesy to save a
 * round trip — this 401 is the actual gate, and it does not care what the client
 * believed about who was signed in.
 *
 * There is no GET: the wishlist page and the hearts on a listing are both server
 * reads through the DAL, so fetching either from the browser would be a round trip
 * bought for nothing.
 */

/** POST /api/wishlist — save a product. Saving one already saved is a no-op. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to add to wishlist" }, { status: 401 });
    }

    const rateLimitResult = await withRateLimit(
      request,
      { interval: 60 * 1000, uniqueTokenPerInterval: 60 },
      () => getRateLimitIdentifier(request, session.user.id)
    );
    if (rateLimitResult) return rateLimitResult;

    const validation = await validateRequest(request, wishlistItemSchema);
    if ("error" in validation) return validation.error;

    await wishlistService.addItem(session.user.id, validation.data.productId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not add that to your wishlist");
  }
}

/**
 * PATCH /api/wishlist — note that a saved product was carted from the wishlist.
 *
 * Only the journey is recorded; whether the wish is cleared is decided later, by a
 * confirmed payment. Marking something not saved is a no-op, so this needs no
 * existence check of its own.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to manage your wishlist" }, { status: 401 });
    }

    const rateLimitResult = await withRateLimit(
      request,
      { interval: 60 * 1000, uniqueTokenPerInterval: 60 },
      () => getRateLimitIdentifier(request, session.user.id)
    );
    if (rateLimitResult) return rateLimitResult;

    const validation = await validateRequest(request, wishlistItemSchema);
    if ("error" in validation) return validation.error;

    await wishlistService.markCartedFromWishlist(session.user.id, validation.data.productId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not update your wishlist");
  }
}

/**
 * DELETE /api/wishlist?productId=… — forget a saved product.
 *
 * Only ever reached from an explicit removal: un-hearting, or Remove on the wishlist
 * page. Nothing else in the app deletes a saved row.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to manage your wishlist" }, { status: 401 });
    }

    const rateLimitResult = await withRateLimit(
      request,
      { interval: 60 * 1000, uniqueTokenPerInterval: 60 },
      () => getRateLimitIdentifier(request, session.user.id)
    );
    if (rateLimitResult) return rateLimitResult;

    const validation = validateQueryParams(
      request.nextUrl.searchParams,
      wishlistItemSchema
    );
    if ("error" in validation) return validation.error;

    await wishlistService.removeItem(session.user.id, validation.data.productId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not remove that from your wishlist");
  }
}
