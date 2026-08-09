/**
 * Org-member image uploads — product images only; categories are platform-owned.
 * POST /api/org/[orgId]/upload — multipart `files`, returns Blob URLs.
 * Any member of the org may upload: the images belong to the org's own products.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { uploadImages } from "@server/catalog/image-upload";

export const POST = withOrg<{ orgId: string }>(async (request) => {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const identifier = formData.get("productSlug") as string | null;

  const urls = await uploadImages(files, "products", identifier);

  return NextResponse.json({ success: true, urls, type: "products", folder: "products" });
});
