/**
 * PUT /api/org/[orgId]/listing-defaults - replace this org's listing defaults
 *
 * PUT, not PATCH: the form always sends the whole set, and a blank means "no default".
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { listingDefaultsSchema } from "@/lib/validation/schemas/listing-defaults.schema";

export const PUT = withOrg(async (request, scope) => {
  const body = listingDefaultsSchema.parse(await request.json());
  const defaults = await orgListingDefaultsService.save(scope.orgId, body);
  return NextResponse.json(defaults);
});
