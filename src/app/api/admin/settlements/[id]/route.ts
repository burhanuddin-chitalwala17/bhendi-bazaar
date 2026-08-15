/**
 * PATCH /api/admin/settlements/[id] — record payment, or cancel.
 *
 * Nothing marks itself paid (spec R21). `PAID` is terminal for the amount and
 * reference; cancelling releases the entries back to unsettled, intact.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { settlementService } from "@server/payouts/settlement.service";
import { toErrorResponse } from "@/lib/api-error-response";

const statusSchema = z.object({
  status: z.enum(["PAID", "CANCELLED"]),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.coerce.date().optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const body = statusSchema.parse(await request.json());
    return NextResponse.json(await settlementService.setSettlementStatus(id, body, session.user.id));
  } catch (error) {
    return toErrorResponse(error, "Could not update the settlement");
  }
}
