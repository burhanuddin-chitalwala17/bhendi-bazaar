/**
 * POST /api/org/[orgId]/media/[assetId]/retire - take an image nothing uses out of the library
 *
 * Refused while anything points at it (spec R7); the stored object goes only after the grace
 * period, by the worker's sweep.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";

export const POST = withOrg<{ orgId: string; assetId: string }>(async (_request, scope, params) => {
  return NextResponse.json(await mediaAssetService.retire(scope.orgId, params.assetId));
});
