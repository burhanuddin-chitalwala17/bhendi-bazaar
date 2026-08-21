/**
 * Org-member image uploads — product images only; categories are platform-owned.
 * POST /api/org/[orgId]/upload — multipart `files`, returns Blob URLs.
 * Any member of the org may upload: the images belong to the org's own products.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { uploadImages } from "@server/catalog/image-upload";
import { orgRepository } from "@server/catalog/org.repository";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  // The product's name — sent by the form so the blob path names the product
  // instead of the old `unnamed-` fallback (bulk-catalog-upload D4).
  const identifier = formData.get("identifier") as string | null;

  const org = await orgRepository.findById(scope.orgId);
  const urls = await uploadImages(files, "products", identifier, org?.code);

  return NextResponse.json({ success: true, urls, type: "products", folder: "products" });
});
