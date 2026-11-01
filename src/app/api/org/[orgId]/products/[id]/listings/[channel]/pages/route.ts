/**
 * GET /api/org/[orgId]/products/[id]/listings/[channel]/pages - pages already on the marketplace for a
 * product, by barcode then name, so it is joined rather than duplicated (marketplace-publish D6).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { listingCreateService } from "@server/channels/listing-create.service";

export const GET = withOrg<{ orgId: string; id: string; channel: string }>(async (_request, scope, params) => {
  return NextResponse.json({ pages: await listingCreateService.findPages(scope.orgId, params.id, params.channel) });
});
