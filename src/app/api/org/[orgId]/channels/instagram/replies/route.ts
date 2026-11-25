/**
 * POST /api/org/[orgId]/channels/instagram/replies - "Done" on the Turn on replies sheet
 *
 * Records that the shop says it allowed message access, so the checklist step waits for the first
 * message (connect-instagram D3, Q19). No body; free, as it calls nothing at Instagram.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { instagramConnection } from "@server/channels/instagram-connection.service";

export const POST = withOrg<{ orgId: string }>(async (_request, scope) => {
  await instagramConnection.repliesAsked(scope.orgId);
  return NextResponse.json({ ok: true });
});
