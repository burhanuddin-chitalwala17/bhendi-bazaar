/**
 * PUT /api/admin/enhancements/settings — the allowance every org starts from, and the platform's
 * daily spend cap.
 *
 * Settings rather than constants, so the owner changes them without a deploy (image-enhancement
 * spec R7, trd D5). The cap arrives in paise (Invariant 3); the form converts the rupees it showed.
 * Recorded in the audit trail, which never fails the save (ADR-0021).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { enhancementService } from "@server/content/enhancement.service";
import { ENHANCEMENT_SETTINGS_ID } from "@server/content/enhancement.types";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { enhancementSettingsSchema } from "@/lib/validation/schemas/enhancement.schema";

export async function PUT(request: NextRequest) {
  try {
    const adminId = await requirePlatformAdminId();
    const body = enhancementSettingsSchema.parse(await request.json());
    const settings = await enhancementService.saveSettings(body);
    await recordAdminAction({
      adminId,
      action: "enhancement.settings.update",
      resource: "enhancement_settings",
      resourceId: ENHANCEMENT_SETTINGS_ID,
      metadata: {
        defaultMonthlyAllowance: body.defaultMonthlyAllowance,
        dailyCapPaise: body.dailyCapPaise,
      },
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return toErrorResponse(error, "Could not save the enhancement settings");
  }
}
