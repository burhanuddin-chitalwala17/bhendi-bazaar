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

export const PUT = withOrg(async (request, scope) => {
  const { channels } = orgChannelsSchema.parse(await request.json());
  return NextResponse.json(await orgChannelService.save(scope.orgId, channels));
});
