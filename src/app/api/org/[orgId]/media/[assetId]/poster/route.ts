/**
 * PUT /api/org/[orgId]/media/[assetId]/poster - the photograph that stands in for this video
 *
 * `{ posterAssetId }` names one of the org's own ready photographs, or is null for the frame the
 * worker cut (video-hosting spec R8). Answers the video's library record as it now reads.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { videoPosterSchema } from "@/lib/validation/schemas/media-library.schema";

export const PUT = withOrg<{ orgId: string; assetId: string }>(async (request, scope, params) => {
  const { posterAssetId } = videoPosterSchema.parse(await request.json());
  return NextResponse.json(await mediaAssetService.replacePoster(scope.orgId, params.assetId, posterAssetId));
});
