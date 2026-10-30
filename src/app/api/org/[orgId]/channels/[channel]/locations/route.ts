/**
 * PUT /api/org/[orgId]/channels/[channel]/locations - the owner's matches between the marketplace's
 * pickup locations and the shop's own (inventory-sync Q15, Q16). Changed only here.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { locationMatchSchema } from "@/lib/validation/schemas/stock-sync.schema";
import { channelLocationService } from "@server/channels/channel-location.service";

export const PUT = withOrg<{ orgId: string; channel: string }>(async (request, scope, params) => {
  const { matches } = locationMatchSchema.parse(await request.json());
  await channelLocationService.save(scope.orgId, params.channel, matches);
  return NextResponse.json({ ok: true });
});
