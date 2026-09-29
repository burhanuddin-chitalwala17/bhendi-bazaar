/**
 * POST /api/admin/bidding/[id]/offers/withdraw — end the open offer early and pass the item
 * to the next bidder (winner-offer R23). Refused while the bidder has a payment moving.
 */
import { NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { offerService } from "@server/bidding/offer.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    await offerService.withdrawCurrent(id, adminId);
    return NextResponse.json({ withdrawn: true });
  } catch (error) {
    return toErrorResponse(error, "Could not withdraw the offer");
  }
}
