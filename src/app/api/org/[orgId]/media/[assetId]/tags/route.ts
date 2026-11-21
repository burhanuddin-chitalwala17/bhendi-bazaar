/**
 * PUT /api/org/[orgId]/media/[assetId]/tags - switch one tag on or off on one of the org's images
 *
 * `{ tag, on }` with a tag from the closed set (ai-images/media-tags R6, D6). Answers the image's
 * library record as it now reads; another org's image is "not found".
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { mediaTagSchema } from "@/lib/validation/schemas/media-library.schema";

export const PUT = withOrg<{ orgId: string; assetId: string }>(async (request, scope, params) => {
  const { tag, on } = mediaTagSchema.parse(await request.json());
  return NextResponse.json(await mediaAssetService.setTag(scope.orgId, params.assetId, tag, on));
});
