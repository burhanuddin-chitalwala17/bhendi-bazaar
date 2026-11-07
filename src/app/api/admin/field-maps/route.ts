/**
 * PUT /api/admin/field-maps — change where one channel field's value comes from
 * (listing-model/field-maps R6, D8). PUT because a map is the whole state of that field; audited,
 * because it changes what every product of the type sends ([ADR-0021]).
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { fieldMapSaveSchema } from "@/lib/validation/schemas/field-map.schema";
import { fieldMapService } from "@server/listing/field-map.service";
import { recordAdminAction } from "@server/shared/audit/audit.service";

export async function PUT(request: NextRequest) {
  try {
    const adminId = await requirePlatformAdminId();
    const body = fieldMapSaveSchema.parse(await request.json());
    const row = await fieldMapService.save(body);
    await recordAdminAction({
      adminId,
      action: "channel.field-map.set",
      resource: "channel",
      resourceId: body.channel,
      metadata: { channelType: body.channelType, fieldPath: body.fieldPath, bbType: body.bbType, source: body.source, key: body.key, constant: body.constant },
    });
    return NextResponse.json(row);
  } catch (error) {
    return toErrorResponse(error, "Couldn't save that. Nothing was changed.");
  }
}
