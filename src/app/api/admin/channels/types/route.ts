/**
 * PUT /api/admin/channels/types — add, remove or mark the publishing marketplace type for one of
 * our types and kinds (marketplace-facts Q26). The publishing type cannot be removed until another
 * is marked, so a type never loses where it publishes.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { channelTypeChangeSchema } from "@/lib/validation/schemas/channel-mapping.schema";
import { channelRegisterService } from "@server/listing/channel-register.service";
import { recordAdminAction } from "@server/shared/audit/audit.service";

export async function PUT(request: NextRequest) {
  try {
    const adminId = await requirePlatformAdminId();
    const change = channelTypeChangeSchema.parse(await request.json());

    if (change.action === "add") {
      const theirCategory = change.theirCategory.trim().toUpperCase().replace(/[ -]+/g, "_");
      const row = await channelRegisterService.addType({ ...change, theirCategory });
      await recordAdminAction({
        adminId,
        action: "channel.type.added",
        resource: "channel",
        resourceId: change.channel,
        metadata: { productType: change.productType, kind: change.kind, theirCategory },
      });
      return NextResponse.json({ id: row.id });
    }
    if (change.action === "publish") {
      const row = await channelRegisterService.markPublishing(change.id);
      await recordAdminAction({
        adminId,
        action: "channel.type.publishing",
        resource: "channel",
        resourceId: row.channel,
        metadata: { productType: row.productType, kind: row.kind, theirCategory: row.theirCategory },
      });
      return NextResponse.json({ id: row.id });
    }
    await channelRegisterService.removeType(change.id, change.typeLabel);
    await recordAdminAction({ adminId, action: "channel.type.removed", resource: "channel", resourceId: change.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Couldn't save that change. Nothing was changed.");
  }
}
