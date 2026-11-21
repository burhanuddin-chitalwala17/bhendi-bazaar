/**
 * GET /api/org/[orgId]/enhancements/styled/quote?references=n - what one AI picture would take
 *
 * The charge with margin, the shop's balance, what must be in credit to ask, and how many pictures
 * the first model can follow (ai-images/improve-with-ai D4): the modal shows the server's numbers.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { styledService } from "@server/content/styled.service";
import { styledQuoteQuerySchema } from "@/lib/validation/schemas/enhancement.schema";

export const GET = withOrg<{ orgId: string }>(async (request, scope) => {
  const { references } = styledQuoteQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return NextResponse.json(await styledService.quote(scope.orgId, references));
}, { feature: FEATURE.IMAGE_ENHANCEMENT });
