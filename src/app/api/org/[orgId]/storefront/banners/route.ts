/**
 * GET  /api/org/[orgId]/storefront/banners - this org's banners
 * POST /api/org/[orgId]/storefront/banners - add one, appended to the end
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { storefrontService } from "@server/catalog/storefront.service";
import { orgBannerSchema } from "@/lib/validation/schemas/org-banner.schema";

export const GET = withOrg(async (_request, scope) => {
  return NextResponse.json(await storefrontService.listBanners(scope.orgId));
});

export const POST = withOrg(async (request, scope) => {
  const body = orgBannerSchema.parse(await request.json());
  const banner = await storefrontService.addBanner(scope.orgId, body);
  return NextResponse.json(banner, { status: 201 });
});
