/**
 * PATCH /api/org/[orgId]/shop/details - save one Shop details section (org-profile D3)
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { shopDetailsSectionSchema } from "@/lib/validation/schemas/shop-details.schema";

// Buyer-facing facts: any member may save them (Q23). The org is the verified membership's.
export const PATCH = withOrg(async (request, scope) => {
  const body = shopDetailsSectionSchema.parse(await request.json());
  return NextResponse.json(await shopDetailsService.saveSection(scope.orgId, body));
});
