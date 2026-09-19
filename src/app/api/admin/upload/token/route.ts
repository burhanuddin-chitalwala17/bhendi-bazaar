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
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { presignUpload } from "@server/catalog/object-store";
import { presignUploadSchema } from "@/lib/validation/schemas/upload.schema";

const PREFIX = "categories/";

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { pathname, contentType, size } = presignUploadSchema.parse(
      await request.json(),
    );
    // The schema rejected traversal segments, so a prefix test is containment here.
    if (!pathname.startsWith(PREFIX)) {
      throw new DomainError(`Uploads must live under ${PREFIX}`);
    }
    return NextResponse.json(await presignUpload(pathname, contentType, size));
  } catch (error) {
    return toErrorResponse(error, "Could not authorise the upload");
  }
}
