/**
 * POST /api/org/[orgId]/storefront/look/revert - switch back to the look kept for 30 days (Q4)
 *
 * The look it restores is the server's record, never the payload's; the body carries only the
 * version the editor saw (Q31). Owners only.
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { storefrontLookService } from "@server/catalog/storefront-look.service";
import { storefrontRevertSchema } from "@/lib/validation/schemas/storefront.schema";

export const POST = withOrg(async (request, scope) => {
  const body = storefrontRevertSchema.parse(await request.json());
  return NextResponse.json(await storefrontLookService.revert(scope.orgId, scope, body));
});
