/**
 * PATCH  /api/admin/payouts/entries/[id] — correct an unsettled entry
 * DELETE /api/admin/payouts/entries/[id] — remove it from balances (soft)
 *
 * Both refuse once the entry's settlement is paid, enforced here rather than only in
 * the UI: a correct-looking screen over a record that no longer matches the bank is
 * the failure this whole distinction exists to prevent.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { settlementService } from "@server/payouts/settlement.service";
import { paiseAmount } from "@/lib/validation/schemas/common.schemas";
import { toErrorResponse } from "@/lib/api-error-response";

// Figures only. An entry's order and organisation are what it *is*, not what it says.
const editSchema = z.object({
  grossItemsPaise: paiseAmount.optional(),
  orgFundedDiscountPaise: paiseAmount.optional(),
  platformFundedDiscountPaise: paiseAmount.optional(),
  commissionPaise: paiseAmount.optional(),
  payablePaise: z.number().int().optional(),
  note: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const body = editSchema.parse(await request.json());
    return NextResponse.json(await settlementService.editEntry(id, body, session.user.id));
  } catch (error) {
    return toErrorResponse(error, "Could not update the entry");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await context.params;
    const reason = new URL(request.url).searchParams.get("reason") ?? undefined;
    return NextResponse.json(await settlementService.removeEntry(id, session.user.id, reason));
  } catch (error) {
    return toErrorResponse(error, "Could not remove the entry");
  }
}
