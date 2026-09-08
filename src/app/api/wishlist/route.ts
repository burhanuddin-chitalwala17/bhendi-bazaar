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
 * DELETE /api/wishlist?productId=… — forget a saved product.
 *
 * The only route that removes a saved product, and it is reached only from an explicit
 * removal: un-hearting, or Remove on the wishlist page. Carting, buying and stocking
 * out never delete a saved row.
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
