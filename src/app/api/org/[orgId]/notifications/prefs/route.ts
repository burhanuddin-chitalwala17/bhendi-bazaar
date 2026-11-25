/** PUT /api/org/[orgId]/notifications/prefs — the member's own morning-email switch for this shop (notifications-core D4). */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { notificationPrefsSchema } from "@/lib/validation/schemas/notifications.schema";
import { notificationsService } from "@server/notifications/notifications.service";

export const PUT = withOrg<{ orgId: string }>(async (request, scope) => {
  const body = notificationPrefsSchema.parse(await request.json());
  await notificationsService.setMorningEmail(scope.userId, scope.orgId, body.morningEmail);
  return NextResponse.json({ morningEmail: body.morningEmail });
});
