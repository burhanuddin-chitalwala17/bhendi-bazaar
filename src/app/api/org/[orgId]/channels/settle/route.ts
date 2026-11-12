/**
 * POST /api/org/[orgId]/channels/settle - add listings as a new product, or match them to one
 * (product-merge D4, D10). Every listing is linked, or none; nothing is written to a marketplace.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { settleListingSchema } from "@/lib/validation/schemas/settle-listing.schema";
import { channelSettleService } from "@server/channels/channel-settle.service";
import { rupeesToPaise } from "@server/shared/money";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  const { price, ...input } = settleListingSchema.parse(await request.json());
  const result = await channelSettleService.settle(scope.orgId, scope.userId, {
    ...input,
    pricePaise: price === undefined ? undefined : rupeesToPaise(price),
  });
  return NextResponse.json({ result });
}, { feature: FEATURE.CHANNELS });
