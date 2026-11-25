/**
 * GET /api/org/[orgId]/notifications — the Needs you sheet for the signed-in member (notifications-core
 * D3): what still needs them, fixed items left out, and the count the badge now shows.
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { notificationsService } from "@server/notifications/notifications.service";
import { registerStillOpenChecks } from "@server/notifications/still-open.registry";

export const GET = withOrg<{ orgId: string }>(async (_request, scope) => {
  registerStillOpenChecks();
  return NextResponse.json(await notificationsService.needsYouView(scope.userId, scope.orgId), { headers: { "Cache-Control": "no-store" } });
});
