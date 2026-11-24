/**
 * GET /api/org/[orgId]/channels/instagram/connect - begin connecting Instagram
 *
 * A link, not a fetch: the browser follows the 302 to Instagram's own sign-in, or straight back to
 * Channels with an outcome when Instagram is not open yet (connect-instagram D1).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { instagramConnect } from "@server/channels/instagram-connect.service";
import { SOCIAL_PLATFORM } from "@server/channels/social/types";
import { ROUTES } from "@server/shared/routes";

export const GET = withOrg<{ orgId: string }>(async (request, scope) => {
  const start = await instagramConnect.start(scope.orgId, scope.userId);
  if ("redirectTo" in start) return NextResponse.redirect(start.redirectTo, 302);
  const back = new URL(ROUTES.org.channels(scope.orgId), request.url);
  back.searchParams.set("result", start.result);
  back.searchParams.set("channel", SOCIAL_PLATFORM.INSTAGRAM);
  return NextResponse.redirect(back, 302);
}, { feature: FEATURE.SOCIAL_SELLING });
