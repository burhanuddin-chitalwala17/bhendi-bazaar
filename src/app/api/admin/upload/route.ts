/**
 * Platform-admin image uploads.
 * POST /api/admin/upload?type=products|categories — multipart `files`, returns Blob URLs.
 * Org members upload through /api/org/[orgId]/upload instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { uploadImages, type ImageFolder } from "@server/catalog/image-upload";
import { DomainError } from "@server/shared/domain-error";

const UPLOAD_TYPES: Record<string, ImageFolder> = {
  products: "products",
  categories: "categories",
};

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();

    const { searchParams } = new URL(request.url);
    const requestedType = searchParams.get("type") || "products";
    const folder = UPLOAD_TYPES[requestedType];
    if (!folder) {
      throw new DomainError(
        `Invalid upload type. Allowed types: ${Object.keys(UPLOAD_TYPES).join(", ")}`
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const identifier =
      folder === "products"
        ? (formData.get("productSlug") as string | null)
        : (formData.get("categorySlug") as string | null);

    const urls = await uploadImages(files, folder, identifier);

    return NextResponse.json({ success: true, urls, type: requestedType, folder });
  } catch (error) {
    return toErrorResponse(error, "Could not upload images");
  }
}
