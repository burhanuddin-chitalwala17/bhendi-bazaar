/**
 * POST /api/org/[orgId]/enhancements - ask for one improvement of one photograph
 *
 * Refused as a shown message when the org is paused, at its allowance, the platform is at its
 * daily spend cap, the slot is the label, or the tool is not built yet (image-enhancement spec R5,
 * R7; trd D5, D8). Otherwise the ledger row and its job are written together, and the answer
 * carries the run and the org's usage line.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { enhancementService } from "@server/content/enhancement.service";
import { requestEnhancementSchema } from "@/lib/validation/schemas/enhancement.schema";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  const input = requestEnhancementSchema.parse(await request.json());
  return NextResponse.json(await enhancementService.request(scope.orgId, scope.userId, input));
});
