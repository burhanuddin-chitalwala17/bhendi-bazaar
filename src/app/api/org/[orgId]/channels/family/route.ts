/**
 * POST /api/org/[orgId]/channels/family - make one family of several marketplace listings, or add
 * them to one (family-merge D3). Every member is saved, or none; nothing changes on the marketplace.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { familySettleSchema } from "@/lib/validation/schemas/family-settle.schema";
import { channelFamilyService } from "@server/channels/channel-family.service";
import { rupeesToPaise } from "@server/shared/money";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  const input = familySettleSchema.parse(await request.json());
  const result = await channelFamilyService.settle(scope.orgId, scope.userId, {
    ...input,
    members: input.members.map(({ price, ...m }) => ({ ...m, pricePaise: price === undefined ? undefined : rupeesToPaise(price) })),
  });
  return NextResponse.json({ result });
}, { feature: FEATURE.CHANNELS });
