/**
 * PATCH  /api/admin/promotions/[id] — edit a platform offer
 * DELETE /api/admin/promotions/[id] — stop one (deactivates; offers are never deleted)
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { promotionFormSchema } from "@/lib/validation/schemas/promotion.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    const body = promotionFormSchema.parse(await request.json());
    return NextResponse.json(await adminPromotionService.update(id, body, { scope: "PLATFORM" }));
  } catch (error) {
    return toErrorResponse(error, "Could not update the offer");
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    await adminPromotionService.deactivate(id, { scope: "PLATFORM" });
    return NextResponse.json({ stopped: true });
  } catch (error) {
    return toErrorResponse(error, "Could not stop the offer");
  }
}
