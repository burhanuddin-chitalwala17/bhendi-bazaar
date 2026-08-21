/**
 * Client-upload tokens for bulk images (bulk-catalog-upload D10): the browser
 * uploads straight to Blob — request bodies through a function are capped at
 * 4.5MB, one large photo — and this route only signs. The token is scoped to the
 * org's own folder and to image types, so a member cannot write outside it.
 */
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@server/catalog/image-upload";
import { orgRepository } from "@server/catalog/org.repository";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const org = await orgRepository.findById(scope.orgId);
    if (!org) throw new DomainError("Organisation not found", { status: 404 });
    const prefix = `products/${org.code.toLowerCase()}/`;

    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // A prefix test alone is not containment: `products/<org>/../other-org/x`
        // starts with the prefix and still leaves it. The client's path is
        // untrusted like any other input (Invariant 4).
        if (pathname.split("/").some((segment) => segment === "." || segment === "..")) {
          throw new DomainError("Upload path may not contain . or .. segments");
        }
        if (!pathname.startsWith(prefix)) {
          throw new DomainError(`Uploads must live under ${prefix}`);
        }
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
      // Nothing to do on completion: the create call records the URLs, and an
      // abandoned wizard's uploads are exactly what the cleanup script reaps.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not authorise the upload");
  }
});
