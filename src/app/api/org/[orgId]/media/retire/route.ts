/**
 * POST /api/org/[orgId]/media/retire - retire up to 100 of the org's library items at once
 *
 * `{ ids }`; answers which ids were retired, still in use, already retired or not found (bulk-actions D1, D2).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaBulkService } from "@server/catalog/media-bulk.service";
import { mediaBulkSchema } from "@/lib/validation/schemas/media-library.schema";

export const POST = withOrg(async (request, scope) => {
  const { ids } = mediaBulkSchema.parse(await request.json());
  return NextResponse.json(await mediaBulkService.retireMany(scope.orgId, ids));
});
