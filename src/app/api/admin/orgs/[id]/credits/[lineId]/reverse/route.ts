/**
 * POST /api/admin/orgs/[id]/credits/[lineId]/reverse — undo a grant or top-up recorded by mistake
 *
 * A new line of the opposite amount, naming the original and why (ai-images/shop-credits R4). The
 * original stays. Platform admin only; audited in the service.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { reverseCreditSchema } from "@/lib/validation/schemas/credit.schema";
import { creditService } from "@server/payouts/credit.service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id, lineId } = await context.params;
    const { reason } = reverseCreditSchema.parse(await request.json());
    await creditService.reverse(id, lineId, reason, adminId);
    return NextResponse.json(await creditService.adminAccount(id));
  } catch (error) {
    return toErrorResponse(error, "Could not reverse the line");
  }
}
