/**
 * POST /api/org/[orgId]/channels/[channel]/listings/dismiss-group - "Not one item" on a suggested
 * group (family-merge Q21): those listings are not suggested together again. Picking still works.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { dismissGroupSchema } from "@/lib/validation/schemas/family-settle.schema";
import { channelImportService } from "@server/channels/channel-import.service";

export const POST = withOrg<{ orgId: string; channel: string }>(async (request, scope) => {
  const { listingIds } = dismissGroupSchema.parse(await request.json());
  await channelImportService.dismissFamilyHint(scope.orgId, listingIds);
  return NextResponse.json({ ok: true });
});
