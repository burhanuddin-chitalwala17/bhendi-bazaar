/**
 * Platform offers.
 * GET  /api/admin/promotions — list
 * POST /api/admin/promotions — create
 *
 * Scope is fixed to PLATFORM here rather than read from the body: which party funds
 * an offer is decided by which door the request came through.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { promotionFormSchema } from "@/lib/validation/schemas/promotion.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json(await adminPromotionService.list({ scope: "PLATFORM" }));
  } catch (error) {
    return toErrorResponse(error, "Could not fetch offers");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const body = promotionFormSchema.parse(await request.json());
    const promotion = await adminPromotionService.create(body, { scope: "PLATFORM" });
    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the offer");
  }
}
