/**
 * POST /api/org/[orgId]/channels/whatsapp/connect - open a WhatsApp sign-up attempt
 *
 * Answers what Meta's pop-up opens with: a signed state that is the shop's one live attempt, and the
 * app's public ids; or an outcome when WhatsApp is not open yet (connect-whatsapp D1). No body.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { FEATURE } from "@/components/subscriptions/features";
import { whatsappConnect } from "@server/channels/whatsapp-connect.service";

export const POST = withOrg<{ orgId: string }>(async (_request, scope) => {
  return NextResponse.json(await whatsappConnect.start(scope.orgId, scope.userId));
}, { feature: FEATURE.SOCIAL_SELLING });
