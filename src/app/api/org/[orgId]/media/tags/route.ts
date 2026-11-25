/**
 * POST /api/org/[orgId]/media/tags - add or remove one tag on up to 100 of the org's photos
 *
 * `{ ids, tag, on }`; answers which ids changed and which were left out and why (bulk-actions D1, D3).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { mediaBulkService } from "@server/catalog/media-bulk.service";
import { mediaBulkTagSchema } from "@/lib/validation/schemas/media-library.schema";

export const POST = withOrg(async (request, scope) => {
  const { ids, tag, on } = mediaBulkTagSchema.parse(await request.json());
  return NextResponse.json(await mediaBulkService.setTagMany(scope.orgId, ids, tag, on));
});
