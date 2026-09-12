/**
 * POST /api/admin/bidding/[id]/sale — record that a bidder bought it, and for how much.
 *
 * The platform's decision, not the organisation's: the organisation never learns who
 * bid (spec R36), so this handler and the page behind it sit under the platform-admin
 * guard. `requirePlatformAdminId` re-reads the user row rather than trusting the JWT
 * claim, which is what makes the id safe to use as the audit line's foreign key
 * (ADR-0021).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { adminBiddingService } from "@server/bidding/admin.bidding.service";
import { confirmSaleSchema } from "@/lib/validation/schemas/bidding.schema";
import { rupeesToPaise } from "@server/shared/money";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    const body = confirmSaleSchema.parse(await request.json());

    await adminBiddingService.confirmSale({
      eventId: id,
      bidId: body.bidId,
      amountPaise: rupeesToPaise(body.amount),
      reason: body.reason ?? null,
      orgAddressId: body.orgAddressId,
      adminId,
    });

    return NextResponse.json({ recorded: true });
  } catch (error) {
    return toErrorResponse(error, "Could not record the sale");
  }
}
