/**
 * GET /api/org/[orgId]/channels/[channel]/connect - begin connecting a marketplace
 *
 * A link, not a fetch: the browser follows the 302 to the marketplace's own consent page, or straight
 * back to Channels with an outcome when the channel is unavailable or full (channel-connectors D5).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { channelConnectionService } from "@server/channels/channel-connection.service";

export const GET = withOrg<{ orgId: string; channel: string }>(async (request, scope, params) => {
  const start = await channelConnectionService.startConnect(scope.orgId, scope.userId, params.channel);
  if ("redirectTo" in start) return NextResponse.redirect(start.redirectTo, 302);
  const back = new URL(`/org/${scope.orgId}/channels`, request.url);
  back.searchParams.set("result", start.result);
  back.searchParams.set("channel", params.channel);
  return NextResponse.redirect(back, 302);
});
