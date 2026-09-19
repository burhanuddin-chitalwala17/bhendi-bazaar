/**
 * PATCH  /api/org/[orgId]/storefront/banners/[bannerId] - edit one
 * DELETE /api/org/[orgId]/storefront/banners/[bannerId] - remove one
 *
 * The banner id is checked against the org in the repository's `where`, so an id from
 * another shop matches nothing rather than being edited by someone entitled to neither.
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { storefrontService } from "@server/catalog/storefront.service";
import { orgBannerSchema } from "@/lib/validation/schemas/org-banner.schema";

export const PATCH = withOrg<{ orgId: string; bannerId: string }>(
  async (request, scope, params) => {
    const body = orgBannerSchema.parse(await request.json());
    await storefrontService.editBanner(scope.orgId, params.bannerId, body);
    return NextResponse.json({ ok: true });
  },
);

export const DELETE = withOrg<{ orgId: string; bannerId: string }>(
  async (_request, scope, params) => {
    await storefrontService.removeBanner(scope.orgId, params.bannerId);
    return NextResponse.json({ ok: true });
  },
);
