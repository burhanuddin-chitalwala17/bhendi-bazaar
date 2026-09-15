/**
 * An organisation's own bidding events.
 * GET  /api/org/[orgId]/bidding
 * POST /api/org/[orgId]/bidding
 *
 * `withOrg` makes being authorised and being scoped the same act: the handler receives
 * an `orgId` that can only have come from a membership check that passed, so an event
 * cannot be opened on another organisation's goods. Nothing reads an org id from the
 * body — that is the shape mass assignment takes here.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { biddingService } from "@server/bidding/bidding.service";
import { biddingFormSchema } from "@/lib/validation/schemas/bidding.schema";

export const GET = withOrg(async (_request, scope) =>
  NextResponse.json(await biddingService.listForOrg(scope.orgId))
);

export const POST = withOrg(async (request, scope) => {
  const body = biddingFormSchema.parse(await request.json());
  const event = await biddingService.create(body, scope.orgId, scope.userId);
  return NextResponse.json(event, { status: 201 });
});
