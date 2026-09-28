/**
 * POST /api/org/[orgId]/brands - add a brand this org sells
 *
 * No GET: the listing-context page reads brands on the server and refreshes after a write.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { brandService } from "@server/catalog/brand.service";
import { brandSchema } from "@/lib/validation/schemas/brand.schema";

export const POST = withOrg(async (request, scope) => {
  // The org comes from the verified membership, never the payload (Invariant 4).
  const body = brandSchema.parse(await request.json());
  const brand = await brandService.create(scope.orgId, body);
  return NextResponse.json(brand, { status: 201 });
});
