/**
 * GET   /api/org/[orgId]/storefront - this org's storefront as it stands
 * PATCH /api/org/[orgId]/storefront - save what it composed
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { storefrontService } from "@server/catalog/storefront.service";
import { storefrontSettingsSchema } from "@/lib/validation/schemas/storefront.schema";

export const GET = withOrg(async (_request, scope) => {
  return NextResponse.json(await storefrontService.getSettings(scope.orgId));
});

export const PATCH = withOrg(async (request, scope) => {
  // The org comes from the verified membership, never the payload (Invariant 4), and
  // the schema carries no `handle` — that is its own operation next door.
  const body = storefrontSettingsSchema.parse(await request.json());
  return NextResponse.json(
    await storefrontService.saveSettings(scope.orgId, body),
  );
});
