/**
 * PATCH /api/admin/settlements/[id] — record payment, or cancel.
 *
 * Nothing marks itself paid (spec R21). `PAID` is terminal for the amount and
 * reference, and needs its proof — method, reference, date, optional receipt (ai-images Q18);
 * cancelling releases the entries back to unsettled, intact.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { settlementService } from "@server/payouts/settlement.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { settlementStatusSchema } from "@/lib/validation/schemas/credit.schema";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const body = settlementStatusSchema.parse(await request.json());
    return NextResponse.json(
      await settlementService.setSettlementStatus(id, body, session.user.id),
    );
  } catch (error) {
    return toErrorResponse(error, "Could not update the settlement");
  }
}
