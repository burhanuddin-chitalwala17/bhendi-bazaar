/**
 * PATCH  /api/org/[orgId]/locations/[locationId] - edit a pickup location
 * DELETE /api/org/[orgId]/locations/[locationId] - remove one (refused while it
 *        holds stock or is named by a shipped parcel — R8)
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { orgAddressService } from "@server/catalog/org.address.service";
import { updateOrgLocationSchema } from "@/lib/validation/schemas/location.schema";

export const PATCH = withOrg<{ orgId: string; locationId: string }>(
  async (request, scope, params) => {
    const body = updateOrgLocationSchema.parse(await request.json());
    const location = await orgAddressService.updateLocation(
      scope.orgId,
      params.locationId,
      body
    );
    return NextResponse.json(location);
  }
);

export const DELETE = withOrg<{ orgId: string; locationId: string }>(
  async (_request, scope, params) => {
    await orgAddressService.removeLocation(scope.orgId, params.locationId);
    return NextResponse.json({ success: true });
  }
);
