/**
 * POST /api/org/[orgId]/channels/[channel]/connection/check - "Check now"
 *
 * One cheap read against the marketplace, recorded as the connection's last contact; changes
 * nothing there (channel-connectors D7, decision Q13).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { channelConnectionService } from "@server/channels/channel-connection.service";

export const POST = withOrg<{ orgId: string; channel: string }>(async (_request, scope, params) => {
  return NextResponse.json({ result: await channelConnectionService.check(scope.orgId, params.channel) });
}, { feature: FEATURE.CHANNELS });
