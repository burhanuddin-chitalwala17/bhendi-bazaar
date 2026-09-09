/**
 * POST /api/bidding/[slug]/bids — place a bid.
 *
 * Public by design: a bidding link is shared into a messaging app and has to work for
 * someone who has never signed in (spec R22). That is why every guard this endpoint
 * relies on is in the database rather than in a session — the guarded update that
 * accepts a bid carries the clock, the price and the event's state at once (bidding D5).
 *
 * A signed-in bidder is identified from their session and asked for nothing further, so
 * a body cannot claim to be someone else (spec R21). Guest details are the only identity
 * a body may supply, and only when there is no session to take one from.
 *
 * Not rate limited, because rate limiting is parked while the cache is unwired
 * (`src/lib/rate-limit/`, spec H8). What caps a bad-faith bidder here is the organisation's
 * maximum increase, which bounds how far one bid can move the price.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { biddingService } from "@server/bidding/bidding.service";
import { placeBidSchema } from "@/lib/validation/schemas/bidding.schema";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import type { BidderIdentity } from "@server/bidding/bidding.types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = placeBidSchema.parse(await request.json());
    const session = await getServerSession(authOptions);

    const bidder: BidderIdentity = session?.user?.id
      ? { kind: "user", userId: session.user.id }
      : guestIdentity(body);

    const view = await biddingService.placeBid({
      slug,
      amount: body.amount,
      expectedHighestBidPaise: body.expectedHighestBid,
      bidder,
    });

    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not place your bid");
  }
}

/**
 * A guest is a name and a number. The email is genuinely optional, and the form has
 * already told them what leaving it out costs (spec R22/R22a).
 */
function guestIdentity(body: {
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
}): BidderIdentity {
  if (!body.guestName) {
    throw new DomainError("Enter your name", { field: "guestName" });
  }
  if (!body.guestPhone) {
    throw new DomainError("Enter your phone number", { field: "guestPhone" });
  }
  return {
    kind: "guest",
    name: body.guestName,
    phone: body.guestPhone,
    email: body.guestEmail ?? null,
  };
}
