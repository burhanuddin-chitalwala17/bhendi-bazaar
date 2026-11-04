/**
 * PUT /api/org/[orgId]/channels/[channel]/stock-sync - pause stock sync, or turn it back on, from the
 * Channels card (inventory-sync Q28). Turning on sends every linked product's count.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { stockSyncChangeSchema } from "@/lib/validation/schemas/stock-sync.schema";
import { channelStockService } from "@server/channels/channel-stock.service";

export const PUT = withOrg<{ orgId: string; channel: string }>(async (request, scope, params) => {
  const { action } = stockSyncChangeSchema.parse(await request.json());
  if (action === "on") await channelStockService.turnOn(scope.orgId, params.channel);
  else await channelStockService.pause(scope.orgId, params.channel);
  return NextResponse.json({ ok: true });
});
