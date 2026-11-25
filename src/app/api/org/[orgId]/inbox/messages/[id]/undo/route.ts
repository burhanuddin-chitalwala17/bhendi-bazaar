/** POST /api/org/[orgId]/inbox/messages/[id]/undo - a held reply cancelled, its text back in the box (Q16); 409 once it has gone. */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { inboxSendService } from "@server/inbox/inbox-send.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";

export const POST = withOrg<{ orgId: string; id: string }>(
  async (_request, scope, params) => NextResponse.json({ reply: await inboxSendService.undo(scope.orgId, params.id) }),
  { feature: FEATURE.SOCIAL_SELLING },
);
