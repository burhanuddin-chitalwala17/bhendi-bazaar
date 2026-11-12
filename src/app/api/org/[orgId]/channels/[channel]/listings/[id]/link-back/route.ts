/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/link-back - restore an unlinked SKU match
 * (channel-import Q16, D10). Linking to any other product is product-merge's.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { channelImportService } from "@server/channels/channel-import.service";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (_request, scope, params) => {
  const listing = await channelImportService.linkBack(scope.orgId, params.id);
  return NextResponse.json({ listing });
}, { feature: FEATURE.CHANNELS });
