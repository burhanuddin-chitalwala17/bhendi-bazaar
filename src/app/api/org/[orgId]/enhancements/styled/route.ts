/**
 * POST /api/org/[orgId]/enhancements/styled - ask for one AI picture of one photograph
 *
 * The shop's description, pictures to follow and face choice (ai-images/improve-with-ai D3). Refused
 * as a shown message when the shop is paused, at its allowance, short of credit, or the platform is at
 * its daily cap; otherwise the row, its credit hold and its job are written together.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { styledService } from "@server/content/styled.service";
import { requestStyledSchema } from "@/lib/validation/schemas/enhancement.schema";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  const input = requestStyledSchema.parse(await request.json());
  return NextResponse.json(await styledService.request(scope.orgId, scope.userId, input));
}, { feature: FEATURE.IMAGE_ENHANCEMENT });
