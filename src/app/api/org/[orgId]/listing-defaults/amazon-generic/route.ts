/**
 * PUT /api/org/[orgId]/listing-defaults/amazon-generic — whether the shop lists on Amazon as Generic,
 * because its brand is not registered there (setup-requests Q35).
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { amazonGenericSchema } from "@/lib/validation/schemas/amazon-generic.schema";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";

export const PUT = withOrg(async (request, scope) => {
  const { amazonGeneric } = amazonGenericSchema.parse(await request.json());
  return NextResponse.json(await orgListingDefaultsService.setAmazonGeneric(scope.orgId, amazonGeneric));
});
