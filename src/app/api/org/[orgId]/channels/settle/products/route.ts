/**
 * GET /api/org/[orgId]/channels/settle/products?listing=…&q=… - the match picker (product-merge Q22)
 *
 * The closest names first when nothing is searched, then the shop's products matching the search.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { channelSettleService } from "@server/channels/channel-settle.service";
import { DomainError } from "@server/shared/domain-error";

export const GET = withOrg<{ orgId: string }>(async (request, scope) => {
  const url = new URL(request.url);
  const listing = url.searchParams.get("listing");
  if (!listing) throw new DomainError("Name the listing being matched.", { status: 400 });
  const products = await channelSettleService.pickerProducts(scope.orgId, listing, url.searchParams.get("q")?.slice(0, 100) ?? null);
  return NextResponse.json(products);
});
