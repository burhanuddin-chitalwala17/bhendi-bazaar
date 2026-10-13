/**
 * PUT /api/admin/channels/not-sold — record that a type does not sell on a channel, or undo it.
 *
 * A decision rather than a blank: an absent row means nobody has chosen yet, and the register
 * lists that as work. Writing it down moves the type out of the worklist and into the decisions
 * beside it, where it stays visible and reversible (channel-registry D12).
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { channelMapRepository } from "@server/listing/channel-map.repository";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { channelNotSoldSchema } from "@/lib/validation/schemas/channel-mapping.schema";

export async function PUT(request: NextRequest) {
  try {
    const adminId = await requirePlatformAdminId();
    const { channel, productType, kind, notSold } = channelNotSoldSchema.parse(
      await request.json(),
    );

    if (notSold) {
      await channelMapRepository.setCategory({
        channel,
        productType,
        kind,
        theirCategory: null,
        notSold: true,
        fit: "EXACT",
        checkedOn: new Date(),
        checkedSource: "Decided in the channel register: not sold here",
      });
    } else {
      // Undoing it removes the row rather than blanking it, so the type reads as undecided again
      // and reappears in the worklist with the choice still to make.
      await channelMapRepository.clearCategory({ channel, productType, kind });
    }

    await recordAdminAction({
      adminId,
      action: notSold ? "channel.type.not-sold" : "channel.type.not-sold.cleared",
      resource: "channel",
      resourceId: channel,
      metadata: { productType, kind },
    });
    return NextResponse.json({ channel, productType, kind, notSold });
  } catch (error) {
    return toErrorResponse(error, "Could not record that decision");
  }
}
