/**
 * Image Upload API Route
 * Uploads images to Vercel Blob storage with organized folder structure
 * POST /api/admin/upload?type=products - Upload single or multiple images
 * 
 * Supported types:
 * - products: Product images
 * - categories: Category hero images
 * - reviews: Review images
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";

// Valid upload types and their folder paths
const UPLOAD_TYPES = {
  products: "products",
  categories: "categories",
} as const;

type UploadType = keyof typeof UPLOAD_TYPES;

// Supported image types
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);
    const uploadType = (searchParams.get("type") || "products") as UploadType;

    if (!UPLOAD_TYPES[uploadType]) {
      return NextResponse.json(
        {
          error: `Invalid upload type. Allowed types: ${Object.keys(
            UPLOAD_TYPES
          ).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    // Get context for naming (optional but recommended)
    const productSlug = formData.get("productSlug") as string | null;
    const categorySlug = formData.get("categorySlug") as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    const folder = UPLOAD_TYPES[uploadType];

    // Helper to sanitize names for filenames
    const sanitizeName = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50);

    let identifier = "unnamed";
    if (uploadType === "products" && productSlug) {
      identifier = sanitizeName(productSlug);
    } else if (uploadType === "categories" && categorySlug) {
      identifier = sanitizeName(categorySlug);
    }

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${file.name}. Allowed: JPEG, PNG, WebP, GIF`,
          },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name} (max 5MB)` },
          { status: 400 }
        );
      }

      // Generate admin-friendly filename
      const timestamp = Date.now();
      const extension = file.name.split(".").pop();
      const filename = `${folder}/${identifier}-${timestamp}.${extension}`;

      // Upload to Vercel Blob
      const blob = await put(filename, file, {
        access: "public",
        addRandomSuffix: false,
      });

      uploadedUrls.push(blob.url);
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
      type: uploadType,
      folder,
    });
  } catch (error) {
    return toErrorResponse(error, "Could not upload images");
  }
}
