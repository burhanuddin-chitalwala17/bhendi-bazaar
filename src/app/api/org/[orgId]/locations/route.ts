/**
 * GET  /api/org/[orgId]/locations - this org's pickup locations
 * POST /api/org/[orgId]/locations - add one
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { orgAddressService } from "@server/catalog/org.address.service";
import { orgLocationSchema } from "@/lib/validation/schemas/location.schema";

export const GET = withOrg(async (_request, scope) => {
  const locations = await orgAddressService.listLocations(scope.orgId);
  return NextResponse.json({ locations });
});

export const POST = withOrg(async (request, scope) => {
  // The org comes from the verified membership, never the payload (Invariant 4).
  const body = orgLocationSchema.parse(await request.json());
  const location = await orgAddressService.addLocation(scope.orgId, body, scope.userId);
  return NextResponse.json(location, { status: 201 });
});
