/**
 * POST /api/org/[orgId]/brands/[brandId]/retire - take a brand out of use
 *
 * Retirement, not deletion (ADR-0032): the row stays, so products that name it keep their values.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { brandService } from "@server/catalog/brand.service";

export const POST = withOrg<{ orgId: string; brandId: string }>(async (_request, scope, params) => {
  const brand = await brandService.retire(scope.orgId, params.brandId);
  return NextResponse.json(brand);
});
