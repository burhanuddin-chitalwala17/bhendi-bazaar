/**
 * GET|HEAD /api/org/[orgId]/media/[assetId]/download - save a library item's original
 * GET redirects to a presigned R2 GET (viewer trd D1); HEAD answers the same status, unredirected (D5).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withOrg<{ orgId: string; assetId: string }>(async (_request, scope, params) => {
  const url = await mediaAssetService.downloadLink(scope.orgId, params.assetId);
  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
});

export const HEAD = withOrg<{ orgId: string; assetId: string }>(async (_request, scope, params) => {
  await mediaAssetService.downloadLink(scope.orgId, params.assetId);
  return new NextResponse(null, { status: 200, headers: NO_STORE });
});
