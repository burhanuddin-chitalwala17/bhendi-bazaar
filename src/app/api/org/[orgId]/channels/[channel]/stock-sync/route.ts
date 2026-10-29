/**
 * PUT /api/org/[orgId]/channels/[channel]/stock-sync - turn stock sync on (after the preview), pause it,
 * or turn it off (inventory-sync D6, Q4). Turning on sends every linked product's count.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { stockSyncChangeSchema } from "@/lib/validation/schemas/stock-sync.schema";
import { channelStockService } from "@server/channels/channel-stock.service";
import { STOCK_SYNC } from "@server/channels/channel-stock.types";

export const PUT = withOrg<{ orgId: string; channel: string }>(async (request, scope, params) => {
  const { action } = stockSyncChangeSchema.parse(await request.json());
  if (action === "on") await channelStockService.turnOn(scope.orgId, params.channel);
  else await channelStockService.setState(scope.orgId, params.channel, action === "pause" ? STOCK_SYNC.PAUSED : STOCK_SYNC.OFF);
  return NextResponse.json({ ok: true });
});
