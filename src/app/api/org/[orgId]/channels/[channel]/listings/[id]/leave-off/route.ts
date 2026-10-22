/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/leave-off - not on Bhendi Bazaar (product-merge Q9)
 *
 * Out of the to-do, and never linked by a read while left off. Nothing changes on the marketplace.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { channelImportService } from "@server/channels/channel-import.service";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (_request, scope, params) => {
  await channelImportService.leaveOff(scope.orgId, scope.userId, params.id);
  return NextResponse.json({ ok: true });
});
