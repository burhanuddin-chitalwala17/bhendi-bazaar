/**
 * PUT /api/admin/credits/settings — the platform's margin on AI pictures, for every shop without one
 * of its own (ai-images/shop-credits D4, Q15). 0% until the owner says otherwise.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { platformMarginSchema } from "@/lib/validation/schemas/credit.schema";
import { creditService } from "@server/payouts/credit.service";

export async function PUT(request: NextRequest) {
  try {
    await requirePlatformAdminId();
    const { marginBps } = platformMarginSchema.parse(await request.json());
    await creditService.setPlatformMargin(marginBps);
    return NextResponse.json({ marginBps });
  } catch (error) {
    return toErrorResponse(error, "Could not change the margin");
  }
}
