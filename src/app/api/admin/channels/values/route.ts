/**
 * PUT /api/admin/channels/values — record what a channel calls one of our answers.
 *
 * PUT because the mapping is the whole state of that pairing: sending it again with a different
 * word is a correction rather than a second mapping (channel-registry R8, D4). Audited, because
 * a mapping decides where somebody else's listing goes ([ADR-0021]).
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { channelMapRepository } from "@server/catalog/channel-map.repository";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { channelValueMappingSchema } from "@/lib/validation/schemas/channel-mapping.schema";

export async function PUT(request: NextRequest) {
  try {
    const adminId = await requirePlatformAdminId();
    const body = channelValueMappingSchema.parse(await request.json());
    const row = await channelMapRepository.setValue({
      ...body,
      checkedOn: new Date(),
      // Says a person decided it rather than a template produced it — the same distinction the
      // seeded rows carry, so a reader can tell which is which.
      checkedSource: "Decided in the channel register",
    });
    await recordAdminAction({
      adminId,
      action: "channel.value-mapping.set",
      resource: "channel",
      resourceId: body.channel,
      metadata: { list: body.list, valueKey: body.valueKey, theirValue: body.theirValue },
    });
    return NextResponse.json(row);
  } catch (error) {
    return toErrorResponse(error, "Could not record that mapping");
  }
}
