/**
 * GET /api/org/[orgId]/posts/[id] - the draft as stored, re-read by the composer after a 409
 * PUT /api/org/[orgId]/posts/[id] - autosave at the version the composer saw; stale is 409 (post-composer D3)
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { postService } from "@server/social/post.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";
import { postDraftSaveSchema } from "@/lib/validation/schemas/post.schema";

type Params = { orgId: string; id: string };

export const GET = withOrg<Params>(async (_request, scope, params) => {
  return NextResponse.json({ post: await postService.get(scope.orgId, params.id) });
}, { feature: FEATURE.SOCIAL_SELLING });

export const PUT = withOrg<Params>(async (request, scope, params) => {
  const body = postDraftSaveSchema.parse(await request.json());
  return NextResponse.json({ post: await postService.saveDraft(scope.orgId, params.id, body) });
}, { feature: FEATURE.SOCIAL_SELLING });
