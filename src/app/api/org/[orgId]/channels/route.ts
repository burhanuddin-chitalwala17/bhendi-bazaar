/**
 * PUT /api/org/[orgId]/channels - where this shop has said it sells
 *
 * PUT, not PATCH: the form sends every channel it showed, and the shop's answer to each is the
 * whole state rather than a change to it.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { orgChannelService } from "@server/listing/org-channel.service";
import { orgChannelsSchema } from "@/lib/validation/schemas/org-channels.schema";
import { lockedError } from "@server/subscriptions/feature-access.service";
import { FEATURE } from "@/components/subscriptions/features";

export const PUT = withOrg(async (request, scope) => {
  const { channels } = orgChannelsSchema.parse(await request.json());
  // Google and Meta are part of Channels: turning one on is paid, turning one off never is (feature-access Q4).
  if (!scope.features.channels && channels.some((c) => c.enabled)) throw lockedError(FEATURE.CHANNELS);
  return NextResponse.json(await orgChannelService.save(scope.orgId, channels));
});
