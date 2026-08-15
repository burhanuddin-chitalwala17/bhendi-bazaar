/**
 * An organisation's own offers.
 * GET  /api/org/[orgId]/promotions
 * POST /api/org/[orgId]/promotions
 *
 * `withOrg` makes being authorised and being scoped the same act: the handler
 * receives an `orgId` that can only have come from a membership check that passed, so
 * an offer cannot be scoped to an organisation the caller does not belong to. Nothing
 * reads an org id from the body — that is the shape mass assignment takes here.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { promotionFormSchema } from "@/lib/validation/schemas/promotion.schema";

export const GET = withOrg(async (_request, scope) =>
  NextResponse.json(await adminPromotionService.list({ scope: "ORG", orgId: scope.orgId }))
);

export const POST = withOrg(async (request, scope) => {
  const body = promotionFormSchema.parse(await request.json());
  const promotion = await adminPromotionService.create(body, { scope: "ORG", orgId: scope.orgId });
  return NextResponse.json(promotion, { status: 201 });
});
