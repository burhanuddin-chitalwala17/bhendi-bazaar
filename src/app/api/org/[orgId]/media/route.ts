/**
 * GET /api/org/[orgId]/media - one page of this org's library, filtered
 *
 * Called by the product editor's picker, which is opened by a tap; the library page itself
 * reads on the server and never calls this.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";

export const GET = withOrg(async (request, scope) => {
  const filters = parseMediaLibraryFilters(new URL(request.url).searchParams);
  return NextResponse.json(await mediaAssetService.listLibrary(scope.orgId, filters));
});
