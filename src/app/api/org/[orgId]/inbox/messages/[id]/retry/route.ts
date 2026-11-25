/** POST /api/org/[orgId]/inbox/messages/[id]/retry - Try again on a reply that was not sent (R9, Q9). */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { inboxSendService } from "@server/inbox/inbox-send.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";

export const POST = withOrg<{ orgId: string; id: string }>(
  async (_request, scope, params) => NextResponse.json({ message: await inboxSendService.retry(scope.orgId, params.id) }),
  { feature: FEATURE.SOCIAL_SELLING },
);
