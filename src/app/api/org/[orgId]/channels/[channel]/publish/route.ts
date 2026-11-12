/**
 * POST /api/org/[orgId]/channels/[channel]/publish - send reviewed listing changes to a marketplace
 * (marketplace-publish D3): only at the versions reviewed, only the fields kept; the rest are refused.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { listingPublishSchema } from "@/lib/validation/schemas/platform-listing.schema";
import { listingPublishService } from "@server/channels/listing-publish.service";

export const POST = withOrg<{ orgId: string; channel: string }>(async (request, scope, params) => {
  const { items } = listingPublishSchema.parse(await request.json());
  return NextResponse.json(await listingPublishService.publish(scope.orgId, params.channel, items));
}, { feature: FEATURE.CHANNELS });
