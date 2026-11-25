/** POST /api/org/[orgId]/inbox/conversations/[id]/messages - a member's reply, held 7 s with Undo (inbox-core D6, Q16). */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { replySchema } from "@/lib/validation/schemas/inbox-reply.schema";
import { inboxSendService } from "@server/inbox/inbox-send.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";

export const POST = withOrg<{ orgId: string; id: string }>(
  async (request, scope, params) => {
    const body = replySchema.parse(await request.json());
    return NextResponse.json({ message: await inboxSendService.send(scope.orgId, scope.userId, params.id, body) }, { status: 201 });
  },
  { feature: FEATURE.SOCIAL_SELLING },
);
