/**
 * Org-member image uploads that still come through a function: the storefront's mark and
 * banners, and promotion art. POST multipart `files`, returns stored URLs.
 *
 * Not the product gallery — that uploads browser-to-store via ./token, because a
 * function request body is capped at 4.5MB and a phone photograph clears it on its own
 * (ADR-0028). These surfaces take desktop-picked art and have not hit it; the same
 * conversion is what they need when they do.
 *
 * Any member of the org may upload: the images belong to the org.
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
  const urls = await uploadImages(files, "products", identifier, org?.code, {
    orgId: scope.orgId,
    uploaderId: scope.userId,
  });

  return NextResponse.json({
    success: true,
    urls,
    type: "products",
    folder: "products",
  });
});
