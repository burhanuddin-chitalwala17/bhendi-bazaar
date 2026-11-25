/** POST /api/org/[orgId]/posts/[id]/caption - draft a caption from the post's products (ai-images/social-posts D3). */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { limitShop } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICY } from "@/lib/rate-limit/policies";
import { postCaptionService } from "@server/social/post-caption.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";
import { captionWriteSchema } from "@/lib/validation/schemas/caption.schema";

export const POST = withOrg<{ orgId: string; id: string }>(
  async (request, scope, params) => {
    // Each call may spend the shop's credit: bounded per shop, not per person (TRD Gates touched).
    const limited = await limitShop("POST /api/org/[orgId]/posts/[id]/caption", scope.orgId, RATE_LIMIT_POLICY.ACCOUNT);
    if (limited) return limited;
    const body = captionWriteSchema.parse(await request.json());
    return NextResponse.json({ draft: await postCaptionService.write(scope.orgId, params.id, body.language) });
  },
  { feature: FEATURE.SOCIAL_SELLING },
);
