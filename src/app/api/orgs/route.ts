/**
 * POST /api/orgs - create an org, with the caller as its first owner.
 *
 * Not under /api/admin: starting an org is self-serve, so this needs a signed-in person
 * rather than a platform admin. Nor under /api/org/[orgId] — there is no org yet to be a
 * member of, which is why this is the one org write that `withOrg` cannot wrap.
 * The body is three fields (org-profile D1); the admin's create keeps its own schema.
 */

import { limitRequest } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/admin-auth";
import { adminOrgService } from "@server/catalog/org.service";
import { openShopSchema } from "@/lib/validation/schemas/org.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const limited = await limitRequest(request, "POST /api/orgs", { userId: session.user.id });
    if (limited) return limited;
    const body = openShopSchema.parse(await request.json());
    const org = await adminOrgService.createOrgWithOwner(body, session.user.id);

    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the organisation");
  }
}
