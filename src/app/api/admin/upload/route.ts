/**
 * Platform-admin image uploads.
 * POST /api/admin/upload?type=products|categories — multipart `files`, returns Blob URLs.
 * Org members upload through /api/org/[orgId]/upload instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { uploadImages } from "@server/catalog/image-upload";
import type { ImageFolder } from "@server/catalog/image-paths";
import { orgRepository } from "@server/catalog/org.repository";
import { DomainError } from "@server/shared/domain-error";

const UPLOAD_TYPES: Record<string, ImageFolder> = {
  products: "products",
  categories: "categories",
  banners: "banners",
};

export async function POST(request: NextRequest) {
  try {
    const uploaderId = await requirePlatformAdminId();

    const { searchParams } = new URL(request.url);
    const requestedType = searchParams.get("type") || "products";
    const folder = UPLOAD_TYPES[requestedType];
    if (!folder) {
      throw new DomainError(
        `Invalid upload type. Allowed types: ${Object.keys(UPLOAD_TYPES).join(", ")}`,
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    // The entity's name, sent by the form — the blob path names what it belongs to
    // instead of the old `unnamed-` fallback (bulk-catalog-upload D4).
    const identifier = formData.get("identifier") as string | null;
    const orgId = formData.get("orgId") as string | null;
    const org =
      folder === "products" && orgId
        ? await orgRepository.findById(orgId)
        : null;

    // Owned by the org when uploading on its behalf, by the platform otherwise (media-library R1).
    const urls = await uploadImages(files, folder, identifier, org?.code, {
      orgId: org?.id ?? null,
      uploaderId,
    });

    return NextResponse.json({
      success: true,
      urls,
      type: requestedType,
      folder,
    });
  } catch (error) {
    return toErrorResponse(error, "Could not upload images");
  }
}
