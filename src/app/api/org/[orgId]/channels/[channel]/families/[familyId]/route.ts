/**
 * POST /api/org/[orgId]/channels/[channel]/families/[familyId] - put a family on a marketplace: its own
 * page and a draft for every member, all waiting for review (marketplace-publish Q11, D7).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { listingCreateService } from "@server/channels/listing-create.service";

export const POST = withOrg<{ orgId: string; channel: string; familyId: string }>(async (_request, scope, params) => {
  return NextResponse.json(await listingCreateService.startFamily(scope.orgId, params.familyId, params.channel));
}, { feature: FEATURE.CHANNELS });
