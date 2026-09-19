/**
 * PATCH /api/org/[orgId]/storefront/banners/reorder - set the running order
 *
 * The whole order at once rather than a move-up/move-down, so the result is what the
 * org saw rather than the sum of several requests that may interleave.
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { storefrontService } from "@server/catalog/storefront.service";
import { bannerReorderSchema } from "@/lib/validation/schemas/org-banner.schema";

export const PATCH = withOrg(async (request, scope) => {
  const { ids } = bannerReorderSchema.parse(await request.json());
  await storefrontService.reorderBanners(scope.orgId, ids);
  return NextResponse.json({ ok: true });
});
