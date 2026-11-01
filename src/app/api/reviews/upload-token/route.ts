/**
 * POST /api/reviews/upload-token — permission for a shopper's browser to upload one
 * review photograph straight to the object store (review-media trd.md D5).
 *
 * The same shape as the org and admin token routes: a presigned PUT rather than a bearer
 * token, with the path and content type signed so neither can widen after approval
 * (ADR-0028). What differs is the gate and the folder — any signed-in shopper may ask, and
 * the folder is not theirs to name: this route keeps the file name it is given and puts it
 * under `reviews/<their own id>/`, so one reviewer cannot write into another's folder and
 * an abusive upload says who made it. The org route tests a prefix instead because an org
 * member legitimately composes paths; a buyer has no reason to.
 *
 * Size is checked by the schema and cannot be signed (ADR-0028), so it is bounded by
 * authentication. Worth stating here because reviewing needs no purchase: the population
 * that can reach this route is every account, not every customer.
 */
import { optionalActiveSession } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError, UnauthorizedError } from "@server/shared/domain-error";
import { presignUpload } from "@server/catalog/object-store";
import { presignUploadSchema } from "@/lib/validation/schemas/upload.schema";
import { limitRequest } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await optionalActiveSession();
    if (!session?.user?.id) {
      throw new UnauthorizedError("Sign in to add a photo to your review");
    }

    const limited = await limitRequest(request, "POST /api/reviews/upload-token", { userId: session.user.id });
    if (limited) return limited;

    const { pathname, contentType, size } = presignUploadSchema.parse(
      await request.json(),
    );
    // Only the last segment is the caller's; the schema has already refused `.`, `..`
    // and empty segments, so this cannot climb out of the folder below.
    const name = pathname.split("/").pop();
    if (!name) throw new DomainError("A file name is required");

    return NextResponse.json(
      await presignUpload(
        `reviews/${session.user.id}/${name}`,
        contentType,
        size,
      ),
    );
  } catch (error) {
    return toErrorResponse(error, "Could not authorise the upload");
  }
}
