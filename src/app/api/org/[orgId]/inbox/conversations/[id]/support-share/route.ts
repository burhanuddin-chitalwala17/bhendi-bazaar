/**
 * POST /api/org/[orgId]/inbox/conversations/[id]/support-share - share this chat with support for one request, 48 hours (inbox-core D9)
 * DELETE /api/org/[orgId]/inbox/conversations/[id]/support-share - stop sharing it, at once
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { inboxPrivacy } from "@server/inbox/inbox-privacy.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";
import { supportShareSchema } from "@/lib/validation/schemas/inbox-privacy.schema";

type Params = { orgId: string; id: string };

export const POST = withOrg<Params>(
  async (request, scope, params) => {
    const body = supportShareSchema.parse(await request.json());
    return NextResponse.json({ share: await inboxPrivacy.share(scope.orgId, scope.userId, params.id, body.requestId) }, { status: 201 });
  },
  { feature: FEATURE.SOCIAL_SELLING },
);

export const DELETE = withOrg<Params>(async (_request, scope, params) => {
  await inboxPrivacy.stopSharing(scope.orgId, params.id);
  return new NextResponse(null, { status: 204 });
});
