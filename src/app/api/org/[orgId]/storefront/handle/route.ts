/**
 * PATCH /api/org/[orgId]/storefront/handle - move this shop to a new public address
 *
 * Its own route rather than a field on the settings PATCH, because it is its own act
 * with its own consequences: the old address works for a window and then stops, and may
 * later belong to someone else (ADR-0030 decision 4). Owners only — a handle change
 * invalidates printed material, which is not a thing staff should be able to do.
 */

import { NextResponse } from "next/server";
import { OrgRole } from "@prisma/client";

import { withOrg } from "@/lib/org-auth";
import { storefrontService } from "@server/catalog/storefront.service";
import { handleChangeSchema } from "@/lib/validation/schemas/storefront.schema";
import { ForbiddenError } from "@server/shared/domain-error";

export const PATCH = withOrg(async (request, scope) => {
  if (scope.role !== OrgRole.OWNER) {
    throw new ForbiddenError("Only an owner can change this shop's address.");
  }
  const { handle } = handleChangeSchema.parse(await request.json());
  return NextResponse.json(
    await storefrontService.changeHandle(scope.orgId, handle),
  );
});
