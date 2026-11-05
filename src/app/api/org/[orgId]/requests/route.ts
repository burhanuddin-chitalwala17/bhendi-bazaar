/**
 * POST /api/org/[orgId]/requests — the shop reports a problem only we can fix (setup-requests Q7, Q24):
 * its own words under a category, with the marketplace's error attached when it came from one.
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { reportIssueSchema } from "@/lib/validation/schemas/requests.schema";
import { requestService } from "@server/requests/request.service";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  const body = reportIssueSchema.parse(await request.json());
  await requestService.report({ orgId: scope.orgId, productId: body.productId, category: body.category, words: body.words, error: body.error });
  return NextResponse.json({ ok: true }, { status: 201 });
});
