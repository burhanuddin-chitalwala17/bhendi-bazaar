/**
 * POST /api/bidding/offers/[token] — accept or decline an auction offer (winner-offer R4, R7).
 *
 * The only way an offer changes hands: the email's links open a page, and the page posts here
 * when the bidder confirms, so a mail scanner opening the link decides nothing. The token is
 * the credential, like the bidding link itself, because a guest winner has no session.
 */
import { NextRequest, NextResponse } from "next/server";
import { offerService } from "@server/bidding/offer.service";
import { offerResponseSchema } from "@/lib/validation/schemas/bidding.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = offerResponseSchema.parse(await request.json());
    const view =
      body.choice === "accept"
        ? await offerService.accept(token)
        : await offerService.decline(token);
    return NextResponse.json(view);
  } catch (error) {
    return toErrorResponse(error, "Could not record your answer");
  }
}
