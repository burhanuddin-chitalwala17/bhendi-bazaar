/**
 * GET /api/org/[orgId]/enhancements/[id] - one run as it stands
 *
 * The compare sheet polls this while the worker runs (image-enhancement spec R3): a read the
 * browser must trigger, since the proposal arrives after the page was rendered. Another org's run
 * is not found.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { enhancementService } from "@server/content/enhancement.service";

export const GET = withOrg<{ orgId: string; id: string }>(async (_request, scope, params) => {
  return NextResponse.json({ enhancement: await enhancementService.get(scope.orgId, params.id) });
});
