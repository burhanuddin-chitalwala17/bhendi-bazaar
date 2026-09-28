/**
 * POST /api/org/[orgId]/enhancements/[id]/accept - keep the proposal
 *
 * The proposal becomes a derived image in the library, pointing at its source (image-enhancement
 * spec R3), and the answer's `resultRef` is what the gallery row takes over. Only a proposed run
 * can be accepted; a second tap is refused as already decided.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { enhancementService } from "@server/content/enhancement.service";

export const POST = withOrg<{ orgId: string; id: string }>(async (_request, scope, params) => {
  return NextResponse.json({ enhancement: await enhancementService.accept(scope.orgId, params.id) });
});
