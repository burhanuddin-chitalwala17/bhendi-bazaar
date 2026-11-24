/**
 * POST /api/org/[orgId]/channels/instagram/connection/check - "Check now"
 *
 * One read of the account, recorded as Last checked; within a minute of the last check it answers
 * from that one (connect-instagram D4).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { instagramConnection } from "@server/channels/instagram-connection.service";

export const POST = withOrg<{ orgId: string }>(async (_request, scope) => {
  return NextResponse.json({ result: await instagramConnection.check(scope.orgId) });
}, { feature: FEATURE.SOCIAL_SELLING });
