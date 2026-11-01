/**
 * POST /api/org/[orgId]/setup/shared — the shop's first Share or Copy link tap, which ticks the
 * last setup step (own-store onboarding D6, Q3). Only the first is kept; later taps write nothing.
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { orgOnboardingService } from "@server/catalog/org-onboarding.service";

export const POST = withOrg(async (_request, scope) => {
  await orgOnboardingService.markShared(scope.orgId);
  return NextResponse.json({ ok: true });
});
