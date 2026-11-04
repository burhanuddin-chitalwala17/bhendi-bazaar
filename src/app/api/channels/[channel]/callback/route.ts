/**
 * GET /api/channels/[channel]/callback - where Amazon and Flipkart send a shop back after consent
 *
 * The URL registered with both marketplaces, so it cannot sit under an org. The shop comes from the
 * signed `state` alone; the signed-in person must be the one who started, and still a member
 * (channel-connectors R2, D4). The code is exchanged inside this request, since Amazon's lives five
 * minutes. Every answer is a redirect to Channels with an outcome code; no marketplace text shows.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveOrgScope } from "@/lib/org-auth";
import { channelConnectionService } from "@server/channels/channel-connection.service";
import { CONNECT_RESULT, type ConnectResult } from "@server/channels/channel-connection.types";
import { ROUTES } from "@server/shared/routes";

function backTo(request: NextRequest, orgId: string | null, channel: string, result: ConnectResult) {
  // A return we cannot attribute to any shop has nowhere better to land than home.
  if (!orgId) return NextResponse.redirect(new URL("/", request.url), 302);
  const url = new URL(ROUTES.org.channels(orgId), request.url);
  url.searchParams.set("result", result);
  url.searchParams.set("channel", channel);
  return NextResponse.redirect(url, 302);
}

export async function GET(request: NextRequest, context: { params: Promise<{ channel: string }> }) {
  const { channel } = await context.params;
  let returned: ReturnType<typeof channelConnectionService.readReturn>;
  try {
    returned = channelConnectionService.readReturn(channel, request.nextUrl.searchParams);
  } catch {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const { consent, check } = returned;
  if (!check.ok) {
    return backTo(request, check.reason === "expired" ? check.state.orgId : null, channel, CONNECT_RESULT.EXPIRED);
  }

  const { state } = check;
  // A state signed for one marketplace is never spent on another's callback (D4).
  if (state.channel !== channel) return backTo(request, state.orgId, channel, CONNECT_RESULT.EXPIRED);
  try {
    const scope = await resolveOrgScope(state.orgId);
    if (scope.userId !== state.userId) return backTo(request, state.orgId, channel, CONNECT_RESULT.OTHER_SESSION);
  } catch {
    return backTo(request, state.orgId, channel, CONNECT_RESULT.OTHER_SESSION);
  }

  const result = await channelConnectionService.completeConnect(state, consent);
  return backTo(request, state.orgId, channel, result);
}
