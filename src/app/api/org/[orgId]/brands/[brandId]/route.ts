/**
 * PATCH /api/org/[orgId]/brands/[brandId] - edit a brand
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { brandService } from "@server/catalog/brand.service";
import { updateBrandSchema } from "@/lib/validation/schemas/brand.schema";

export const PATCH = withOrg<{ orgId: string; brandId: string }>(async (request, scope, params) => {
  const body = updateBrandSchema.parse(await request.json());
  const brand = await brandService.update(scope.orgId, params.brandId, body);
  return NextResponse.json(brand);
});
