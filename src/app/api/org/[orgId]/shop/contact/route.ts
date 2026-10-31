/**
 * PATCH /api/org/[orgId]/shop/contact - change the shop's name, mobile or email (org-profile D7)
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { shopContactSchema } from "@/lib/validation/schemas/shop-details.schema";

// Owner-only, like the handle route (Q23): the service refuses staff with the ux copy.
export const PATCH = withOrg(async (request, scope) => {
  const body = shopContactSchema.parse(await request.json());
  return NextResponse.json(await shopDetailsService.saveContact(scope.orgId, scope, body));
});
