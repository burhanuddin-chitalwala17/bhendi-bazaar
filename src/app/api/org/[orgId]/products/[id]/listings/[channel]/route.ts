/**
 * PUT /api/org/[orgId]/products/[id]/listings/[channel] - save a product's listing on one marketplace:
 * only its own values; saving never sends anything (channel-listings R8, D4).
 * POST - start a draft for a product not yet there: on a page found, or a new one (marketplace-publish Q7).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { listingDraftSchema, listingSaveSchema } from "@/lib/validation/schemas/platform-listing.schema";
import { rupeesToPaise } from "@server/shared/money";
import { platformListingService } from "@server/channels/platform-listing.service";
import { listingCreateService } from "@server/channels/listing-create.service";

export const PUT = withOrg<{ orgId: string; id: string; channel: string }>(async (request, scope, params) => {
  const { seenVersion, overrides } = listingSaveSchema.parse(await request.json());
  const { price, ...rest } = overrides;
  const result = await platformListingService.save(scope.orgId, params.id, params.channel, {
    seenVersion,
    overrides: { ...rest, ...(price === undefined ? {} : { price: rupeesToPaise(price) }) },
  });
  return NextResponse.json(result);
});

export const POST = withOrg<{ orgId: string; id: string; channel: string }>(async (request, scope, params) => {
  const { mode, targetExternalId } = listingDraftSchema.parse(await request.json());
  return NextResponse.json(await listingCreateService.startDraft(scope.orgId, params.id, params.channel, { mode, targetExternalId }));
});
