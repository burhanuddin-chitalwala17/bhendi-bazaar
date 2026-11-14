/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/unlink - undo a link (channel-import Q5, D10)
 *
 * The listing returns to Not linked and no later read links it again by itself.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { channelImportService } from "@server/channels/channel-import.service";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (_request, scope, params) => {
  await channelImportService.unlink(scope.orgId, scope.userId, params.id);
  return NextResponse.json({ ok: true });
}, { feature: FEATURE.CHANNELS });
