/**
 * GET /api/org/[orgId]/posts/[id]/caption/price - drafted prices the saved caption states that have changed (journey 5)
 * POST /api/org/[orgId]/posts/[id]/caption/price - Update price: swap them for today's and save the draft (D4)
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { postCaptionService } from "@server/social/post-caption.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";

type Params = { orgId: string; id: string };

export const GET = withOrg<Params>(async (_request, scope, params) => {
  return NextResponse.json({ changes: await postCaptionService.priceChanges(scope.orgId, params.id) });
}, { feature: FEATURE.SOCIAL_SELLING });

export const POST = withOrg<Params>(async (_request, scope, params) => {
  return NextResponse.json(await postCaptionService.updatePrice(scope.orgId, params.id));
}, { feature: FEATURE.SOCIAL_SELLING });
