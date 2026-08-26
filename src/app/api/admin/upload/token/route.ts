/**
 * Client-upload tokens for admin bulk images (D10) — scoped to the categories
 * folder; product uploads go through the org member route.
 */
import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@server/catalog/image-upload";

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // A prefix test alone is not containment — see the org route.
        if (pathname.split("/").some((segment) => segment === "." || segment === "..")) {
          throw new DomainError("Upload path may not contain . or .. segments");
        }
        if (!pathname.startsWith("categories/")) {
          throw new DomainError("Uploads must live under categories/");
        }
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not authorise the upload");
  }
}
