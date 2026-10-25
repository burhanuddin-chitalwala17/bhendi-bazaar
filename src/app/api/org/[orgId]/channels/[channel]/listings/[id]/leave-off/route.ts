/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/leave-off - not on Bhendi Bazaar (product-merge Q9)
 *
 * Out of the to-do, and never linked by a read while left off. Nothing changes on the marketplace.
 * With `reason: "no_type"` it waits for a product type (marketplace-facts Q6).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { channelImportService } from "@server/channels/channel-import.service";
import { leaveOffSchema } from "@/lib/validation/schemas/marketplace-facts.schema";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (request, scope, params) => {
  const { reason } = leaveOffSchema.parse(await request.json().catch(() => ({})));
  await channelImportService.leaveOff(scope.orgId, scope.userId, params.id, reason ?? null);
  return NextResponse.json({ ok: true });
});
