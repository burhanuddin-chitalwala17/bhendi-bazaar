/**
 * POST / DELETE /api/org/[orgId]/setup/hidden — "Hide for now" and its undo on Home's setup list
 * (own-store onboarding D6, Q6, Q23). Per shop; both are idempotent, so a double tap writes once.
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { orgOnboardingService } from "@server/catalog/org-onboarding.service";

// No body: the shop is the URL and the session.
export const POST = withOrg(async (_request, scope) => {
  await orgOnboardingService.hide(scope.orgId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withOrg(async (_request, scope) => {
  await orgOnboardingService.show(scope.orgId);
  return NextResponse.json({ ok: true });
});
