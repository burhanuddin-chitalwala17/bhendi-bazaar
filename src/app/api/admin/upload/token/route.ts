/**
 * Permission for an admin's browser to upload one bulk category image straight to the
 * object store (D10) — scoped to the categories folder; product uploads go through the
 * org member route.
 *
 * Returns a presigned PUT rather than a bearer token (ADR-0028): the signature binds
 * the path, the type and the exact byte count, so none of them can change after we
 * approved them.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { presignUploadSchema } from "@/lib/validation/schemas/upload.schema";

const PREFIX = "categories/";

export async function POST(request: NextRequest) {
  try {
    const uploaderId = await requirePlatformAdminId();
    const { pathname, contentType, size, contentHash } = presignUploadSchema.parse(
      await request.json(),
    );
    // The schema rejected traversal segments, so a prefix test is containment here.
    if (!pathname.startsWith(PREFIX)) {
      throw new DomainError(`Uploads must live under ${PREFIX}`);
    }
    // Platform-owned: category art has no org. Registered before signing (media-library R1).
    return NextResponse.json(
      await mediaAssetService.beginUpload({ orgId: null, uploaderId, pathname, contentType, size, contentHash }),
    );
  } catch (error) {
    return toErrorResponse(error, "Could not authorise the upload");
  }
}
