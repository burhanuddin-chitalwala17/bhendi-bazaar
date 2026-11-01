/**
 * PUT /api/org/[orgId]/storefront/look - publish a theme and palette (storefront-themes D11)
 *
 * Its own route rather than a field on the settings PATCH: content saves are live at once, a look
 * waits for Publish and compares-and-sets on the version the editor saw (Q4, Q31). Owners only.
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { storefrontLookService } from "@server/catalog/storefront-look.service";
import { storefrontLookSchema } from "@/lib/validation/schemas/storefront.schema";

export const PUT = withOrg(async (request, scope) => {
  const body = storefrontLookSchema.parse(await request.json());
  return NextResponse.json(await storefrontLookService.publish(scope.orgId, scope, body));
});
