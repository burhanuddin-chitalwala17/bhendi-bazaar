/** POST /api/admin/settlements — claim unsettled entries into a settlement. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { settlementService } from "@server/payouts/settlement.service";
import { toErrorResponse } from "@/lib/api-error-response";

const createSchema = z.object({
  orgId: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1, "Choose at least one entry to settle"),
  note: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const body = createSchema.parse(await request.json());
    const settlement = await settlementService.createSettlement(body, session.user.id);
    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the settlement");
  }
}
