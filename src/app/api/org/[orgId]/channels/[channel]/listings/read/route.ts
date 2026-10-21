/**
 * POST /api/org/[orgId]/channels/[channel]/listings/read - "Read again" (channel-import R2, D10)
 *
 * Queues a read of every listing; one read runs per connection at a time (D3).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { channelImportService } from "@server/channels/channel-import.service";

export const POST = withOrg<{ orgId: string; channel: string }>(async (_request, scope, params) => {
  await channelImportService.requestRead(scope.orgId, params.channel);
  return NextResponse.json({ ok: true });
});
