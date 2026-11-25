/** POST /api/org/[orgId]/posts/[id]/duplicate - a new draft from any post of the shop (R10, Q7). */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { postService } from "@server/social/post.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";

export const POST = withOrg<{ orgId: string; id: string }>(
  async (_request, scope, params) => {
    return NextResponse.json({ post: await postService.duplicate(scope.orgId, scope.userId, params.id) }, { status: 201 });
  },
  { feature: FEATURE.SOCIAL_SELLING },
);
