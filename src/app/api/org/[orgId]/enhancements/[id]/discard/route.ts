/**
 * POST /api/org/[orgId]/enhancements/[id]/discard - let the proposal go
 *
 * The proposal object is deleted and the run marked discarded, so it appears nowhere afterwards
 * (image-enhancement spec R3, A8). Only a proposed run can be discarded.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { enhancementService } from "@server/content/enhancement.service";

export const POST = withOrg<{ orgId: string; id: string }>(async (_request, scope, params) => {
  return NextResponse.json({ enhancement: await enhancementService.discard(scope.orgId, params.id) });
});
