/**
 * GET  /api/products/[id]/reviews — the next page of a product's reviews.
 * POST /api/products/[id]/reviews — write one.
 *
 * Both are route handlers because a browser must call them (CLAUDE.md): extending the
 * list in place is interaction-triggered, and a submission is a mutation. The *first*
 * page is not here — the product page reads it server-side through `reviewsDAL`, so the
 * reviews are in the HTML rather than behind a spinner (trd.md D13).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { reviewService } from "@server/catalog/review.service";
import { UnauthorizedError } from "@server/shared/domain-error";
import { toErrorResponse } from "@/lib/api-error-response";
import { limitRequest } from "@/lib/rate-limit";
import {
  reviewPageQuerySchema,
  reviewSubmissionSchema,
} from "@/lib/validation/schemas/review.schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { page } = reviewPageQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const session = await getServerSession(authOptions);
    const result = await reviewService.getPage(
      id,
      page,
      session?.user?.id ?? null,
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not load reviews:");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    // The sign-in panel opens before the form is shown, but that is a courtesy. This is
    // the gate, and it does not care what the client believed (R7).
    if (!session?.user?.id) {
      throw new UnauthorizedError("Sign in to write a review");
    }

    // Volume only; R10 is what caps a repeat reviewer's influence, a different job.
    const limited = await limitRequest(request, "POST /api/products/[id]/reviews", { userId: session.user.id });
    if (limited) return limited;

    const { id } = await params;
    const input = reviewSubmissionSchema.parse(await request.json());
    const review = await reviewService.create(session.user.id, id, input);

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not save your review:");
  }
}
