/**
 * PATCH  /api/reviews/[id] — the author edits their own review.
 * DELETE /api/reviews/[id] — the author deletes it.
 *
 * Each review stands on its own, so both act on one review and leave that shopper's
 * others alone (R9). Ownership is enforced in the statement, not by a prior read, and a
 * review belonging to somebody else answers the same 404 as one that does not exist —
 * this endpoint is not a way to discover which ids are real.
 *
 * Withdrawing a published review is a different act with a different actor, and lives at
 * `/api/admin/reviews/[id]` (R15, R17).
 */

import { limitRequest } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { reviewService } from "@server/catalog/review.service";
import { UnauthorizedError } from "@server/shared/domain-error";
import { toErrorResponse } from "@/lib/api-error-response";
import { reviewSubmissionSchema } from "@/lib/validation/schemas/review.schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new UnauthorizedError("Sign in to edit your review");
    }
    const limited = await limitRequest(request, "PATCH /api/reviews/[id]", { userId: session.user.id });
    if (limited) return limited;

    const { id } = await params;
    const input = reviewSubmissionSchema.parse(await request.json());
    await reviewService.edit(id, session.user.id, input);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not update your review:");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new UnauthorizedError("Sign in to delete your review");
    }
    const limited = await limitRequest(request, "DELETE /api/reviews/[id]", { userId: session.user.id });
    if (limited) return limited;

    const { id } = await params;
    await reviewService.remove(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not delete your review:");
  }
}
