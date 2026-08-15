/**
 * PATCH  /api/org/[orgId]/promotions/[id]
 * DELETE /api/org/[orgId]/promotions/[id] — stops it; offers are never deleted
 *
 * The scope filter is part of the update's `where`, so another organisation's offer
 * id updates nothing rather than updating it.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { adminPromotionService } from "@server/promotions/admin.promotion.service";
import { promotionFormSchema } from "@/lib/validation/schemas/promotion.schema";

export const PATCH = withOrg<{ orgId: string; id: string }>(async (request, scope, params) => {
  const body = promotionFormSchema.parse(await request.json());
  return NextResponse.json(
    await adminPromotionService.update(params.id, body, { scope: "ORG", orgId: scope.orgId })
  );
});

export const DELETE = withOrg<{ orgId: string; id: string }>(async (_request, scope, params) => {
  await adminPromotionService.deactivate(params.id, { scope: "ORG", orgId: scope.orgId });
  return NextResponse.json({ stopped: true });
});
