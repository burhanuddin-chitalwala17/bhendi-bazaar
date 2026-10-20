/**
 * DELETE /api/org/[orgId]/channels/[channel]/connection - disconnect a marketplace
 *
 * Deletes our access and turns the channel off; the shop's listings on the marketplace are left as
 * they are (channel-connectors R7, decision Q9).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { channelConnectionService } from "@server/channels/channel-connection.service";

export const DELETE = withOrg<{ orgId: string; channel: string }>(async (_request, scope, params) => {
  await channelConnectionService.disconnect(scope.orgId, scope.userId, params.channel);
  return NextResponse.json({ ok: true });
});
