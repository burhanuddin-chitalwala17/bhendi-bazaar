/**
 * POST /api/admin/bidding/[id]/unsold — nobody went through with it (spec R39a).
 *
 * The product returns to sale as though it had never been bid on, and every bid stays
 * on record. An event that drew bids does not oblige a sale.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { adminBiddingService } from "@server/bidding/admin.bidding.service";
import { markUnsoldSchema } from "@/lib/validation/schemas/bidding.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    const body = markUnsoldSchema.parse(await request.json());

    await adminBiddingService.markUnsold({
      eventId: id,
      reason: body.reason ?? null,
      adminId,
    });

    return NextResponse.json({ recorded: true });
  } catch (error) {
    return toErrorResponse(error, "Could not record the outcome");
  }
}
