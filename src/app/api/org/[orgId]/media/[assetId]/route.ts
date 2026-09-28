/**
 * GET /api/org/[orgId]/media/[assetId] - an asset and every place it is used
 *
 * Fetched when the library's detail sheet opens: the uses are a query per asset (trd D7), so
 * they are read for the one the org is looking at rather than for every tile on the page.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";

export const GET = withOrg<{ orgId: string; assetId: string }>(async (_request, scope, params) => {
  return NextResponse.json(await mediaAssetService.assetDetail(scope.orgId, params.assetId));
});
