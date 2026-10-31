/**
 * POST /api/org/[orgId]/products/readiness — what each place this shop sells on would still ask
 * of the product as it stands in the form, before it is saved (product-form D4, Q8).
 *
 * A POST because the unsaved answers are a body, not a query; it writes nothing. A route because
 * the browser asks it on leaving a step, an interaction a server render cannot answer (ADR-0034).
 */

import { NextResponse } from "next/server";
import { DomainError } from "@server/shared/domain-error";
import { withOrg } from "@/lib/org-auth";
import { channelReadinessService } from "@server/listing/channel-readiness.service";
import { productReadinessSchema } from "@/lib/validation/schemas/product.schema";

export const POST = withOrg(async (request, scope) => {
  // Unparseable JSON is the caller's fault: a 400 in the envelope, not an internal 500.
  const raw = await request.json().catch(() => {
    throw new DomainError("The request body is not valid JSON");
  });
  const body = productReadinessSchema.parse(raw);
  // The org is the verified membership's, so a hint can never read another shop's channels.
  return NextResponse.json(await channelReadinessService.forUnsaved(scope.orgId, body));
});
