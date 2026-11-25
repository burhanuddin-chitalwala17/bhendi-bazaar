/** GET /api/org/[orgId]/inbox/privacy - "Who has opened your chats", and what is shared with support now (inbox-core D9, R14). */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { inboxPrivacy } from "@server/inbox/inbox-privacy.service";

export const GET = withOrg(async (_request, scope) => {
  return NextResponse.json({ privacy: await inboxPrivacy.forShop(scope.orgId) });
});
