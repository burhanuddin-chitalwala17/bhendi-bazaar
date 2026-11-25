/**
 * POST /api/org/[orgId]/media/download-links - presigned links for a zip the browser builds
 *
 * `{ ids }`; answers `{ files, noFile, totalBytes }`, or 422 with the totals above 500 MB (bulk-actions D1, D4).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaBulkService } from "@server/catalog/media-bulk.service";
import { mediaBulkSchema } from "@/lib/validation/schemas/media-library.schema";

export const POST = withOrg(async (request, scope) => {
  const { ids } = mediaBulkSchema.parse(await request.json());
  return NextResponse.json(await mediaBulkService.downloadLinks(scope.orgId, ids));
});
