/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/bring-back - back to the to-do (product-merge Q9)
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { channelImportService } from "@server/channels/channel-import.service";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (_request, scope, params) => {
  await channelImportService.bringBack(scope.orgId, params.id);
  return NextResponse.json({ ok: true });
});
