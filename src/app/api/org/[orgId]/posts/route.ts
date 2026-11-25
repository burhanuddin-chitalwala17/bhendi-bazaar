/** POST /api/org/[orgId]/posts - start a draft (post-composer D3); any member composes (R1). */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { postService } from "@server/social/post.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";
import { postDraftSchema } from "@/lib/validation/schemas/post.schema";

export const POST = withOrg(
  async (request, scope) => {
    const body = postDraftSchema.parse(await request.json());
    return NextResponse.json({ post: await postService.createDraft(scope.orgId, scope.userId, body) }, { status: 201 });
  },
  { feature: FEATURE.SOCIAL_SELLING },
);
