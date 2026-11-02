/**
 * PUT /api/org/[orgId]/products/facts - one missing fact answered for many products from a fix page,
 * saved as picked into empty answers only; or one product's pick taken back (readiness-fix R3, R4).
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { readinessFixSchema } from "@/lib/validation/schemas/platform-listing.schema";
import { readinessFixService } from "@server/listing/readiness-fix.service";

export const PUT = withOrg<{ orgId: string }>(async (request, scope) => {
  const { fact, value, productIds, undo } = readinessFixSchema.parse(await request.json());
  if (undo) return NextResponse.json({ undone: await readinessFixService.undo(scope.orgId, fact, value, productIds[0]) });
  return NextResponse.json(await readinessFixService.answer(scope.orgId, fact, value, productIds));
});
