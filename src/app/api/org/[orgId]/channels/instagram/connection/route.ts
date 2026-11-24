/**
 * DELETE /api/org/[orgId]/channels/instagram/connection - disconnect Instagram
 *
 * Stops webhooks at Instagram, deletes our token and keeps the record Disconnected
 * (connect-instagram D5, R10). Free, as every disconnect is.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { instagramConnection } from "@server/channels/instagram-connection.service";

export const DELETE = withOrg<{ orgId: string }>(async (_request, scope) => {
  await instagramConnection.disconnect(scope.orgId, scope.userId);
  return NextResponse.json({ ok: true });
});
