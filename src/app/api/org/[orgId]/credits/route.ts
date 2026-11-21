/**
 * GET /api/org/[orgId]/credits - this shop's credit: balance, a page of lines, where to pay
 *
 * Read by the credit sheet on the Photos page (ai-images/shop-credits R8). Free to every member:
 * a shop may always see what it has.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { creditService } from "@server/payouts/credit.service";

export const GET = withOrg(async (request, scope) => {
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  return NextResponse.json(await creditService.account(scope.orgId, page));
});
