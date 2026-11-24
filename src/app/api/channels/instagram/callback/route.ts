/**
 * GET /api/channels/instagram/callback - where Instagram sends a shop back after sign-in
 *
 * Registered with Meta, so it cannot sit under an org. The shop comes from the signed `state`; the
 * signed-in person must be the one who started, and still a member (connect-instagram R2). Every
 * answer is a redirect to Channels with an outcome code; no Instagram text shows.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveOrgScope } from "@/lib/org-auth";
import { instagramConnect } from "@server/channels/instagram-connect.service";
import { CONNECT_RESULT, type ConnectResult } from "@server/channels/channel-connection.types";
import { SOCIAL_PLATFORM } from "@server/channels/social/types";
import { ROUTES } from "@server/shared/routes";

function backTo(request: NextRequest, orgId: string | null, result: ConnectResult) {
  if (!orgId) return NextResponse.redirect(new URL("/", request.url), 302);
  const url = new URL(ROUTES.org.channels(orgId), request.url);
  url.searchParams.set("result", result);
  url.searchParams.set("channel", SOCIAL_PLATFORM.INSTAGRAM);
  return NextResponse.redirect(url, 302);
}

export async function GET(request: NextRequest) {
  const { consent, check } = instagramConnect.readReturn(request.nextUrl.searchParams);
  if (!check.ok) return backTo(request, check.reason === "expired" ? check.state.orgId : null, CONNECT_RESULT.EXPIRED);

  const { state } = check;
  try {
    const scope = await resolveOrgScope(state.orgId);
    if (scope.userId !== state.userId) return backTo(request, state.orgId, CONNECT_RESULT.OTHER_SESSION);
  } catch {
    return backTo(request, state.orgId, CONNECT_RESULT.OTHER_SESSION);
  }

  try {
    return backTo(request, state.orgId, await instagramConnect.complete(state, consent));
  } catch (error) {
    // Logged by kind only; the person lands on Channels told Instagram didn't respond.
    console.error(JSON.stringify({ scope: "channels.instagram", step: "callback", error: (error as Error | null)?.name ?? "unknown" }));
    return backTo(request, state.orgId, CONNECT_RESULT.UNREACHABLE);
  }
}
