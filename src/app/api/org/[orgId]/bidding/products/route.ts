/**
 * GET /api/org/[orgId]/bidding/products?q= — this org's products that could go up for
 * bidding right now.
 *
 * Products already under a live event are left out rather than shown and refused: the
 * picker is where an org learns what is available, so offering a choice that cannot be
 * taken is a worse answer than a shorter list (spec R7).
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { biddingService } from "@server/bidding/bidding.service";

export const GET = withOrg(async (request, scope) => {
  const search = new URL(request.url).searchParams.get("q") ?? undefined;
  return NextResponse.json(await biddingService.pickableProducts(scope.orgId, search));
});
