/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/photos/retry - copy a listing's photos again
 * (product-merge Q21). Photos already copied are reused, not stored twice.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { channelSettleService } from "@server/channels/channel-settle.service";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (_request, scope, params) => {
  await channelSettleService.retryPhotos(scope.orgId, params.id);
  return NextResponse.json({ ok: true });
}, { feature: FEATURE.CHANNELS });
