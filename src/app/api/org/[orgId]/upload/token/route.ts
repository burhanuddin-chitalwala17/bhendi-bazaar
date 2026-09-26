/**
 * Permission for an org member's browser to upload one bulk product image straight to
 * the object store (bulk-catalog-upload D10): request bodies through a function are
 * capped at 4.5MB, one large photo, so the browser writes directly and this route only
 * signs.
 *
 * A presigned PUT rather than a bearer token (ADR-0028). The signature binds the path,
 * the content type and the exact byte count, so a browser cannot widen any of them
 * after approval — which is what keeps MAX_IMAGE_BYTES a limit (Invariant 4).
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { orgRepository } from "@server/catalog/org.repository";
import { presignUploadSchema } from "@/lib/validation/schemas/upload.schema";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const org = await orgRepository.findById(scope.orgId);
    if (!org) throw new DomainError("Organisation not found", { status: 404 });
    const prefix = `products/${org.code.toLowerCase()}/`;

    const { pathname, contentType, size } = presignUploadSchema.parse(
      await request.json(),
    );
    // A prefix test alone is not containment — `products/<org>/../other-org/x` starts
    // with the prefix and still leaves it. The schema rejects `.`/`..` segments first,
    // so by here the prefix test means what it says.
    if (!pathname.startsWith(prefix)) {
      throw new DomainError(`Uploads must live under ${prefix}`);
    }
    // Register before signing: the record exists before the bytes move (media-library R1).
    return NextResponse.json(
      await mediaAssetService.beginUpload({
        orgId: scope.orgId,
        uploaderId: scope.userId,
        pathname,
        contentType,
        size,
      }),
    );
  } catch (error) {
    return toErrorResponse(error, "Could not authorise the upload");
  }
});
