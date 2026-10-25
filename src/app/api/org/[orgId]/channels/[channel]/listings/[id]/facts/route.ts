/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/facts - the "Facts from {marketplace}" card's
 * commands (marketplace-facts D8): fill now, answer, change, reset, skip, or choose a category.
 * Writes only to this shop's product; nothing changes on the marketplace.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { marketplaceFactsChangeSchema } from "@/lib/validation/schemas/marketplace-facts.schema";
import { channelFactsService } from "@server/channels/channel-facts.service";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (request, scope, params) => {
  const change = marketplaceFactsChangeSchema.parse(await request.json());
  const result = await channelFactsService.change(scope.orgId, params.id, change);
  return NextResponse.json({ ok: true, ...result });
});
