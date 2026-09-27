/**
 * POST /api/org/[orgId]/media/[assetId]/crop — reframe a photograph the org already has
 *
 * The cut is made where the bytes already are, and the result is a derived image beside its
 * source, which is left exactly as it was (media-library R8a, trd D6a).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { cropTransformSchema } from "@/lib/validation/schemas/upload.schema";

export const POST = withOrg<{ orgId: string; assetId: string }>(async (request, scope, params) => {
  const transform = cropTransformSchema.parse(await request.json());
  return NextResponse.json(
    await mediaAssetService.cropAsset(scope.orgId, scope.userId, params.assetId, transform),
  );
});
