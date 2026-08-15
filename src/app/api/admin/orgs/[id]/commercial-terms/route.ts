/**
 * PATCH /api/admin/orgs/[id]/commercial-terms — what the platform charges an org.
 *
 * Platform admin only, and deliberately not part of the org profile update: that
 * endpoint's schema is shared with `/api/orgs`, which any signed-in user may call.
 * Keeping the rate on its own admin-guarded route is what stops an organisation
 * setting its own commission.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { ledgerService } from "@server/payouts/ledger.service";
import { commercialTermsSchema } from "@/lib/validation/schemas/commercial-terms.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    const body = commercialTermsSchema.parse(await request.json());
    await ledgerService.setCommercialTerms(id, body);
    return NextResponse.json({ updated: true });
  } catch (error) {
    return toErrorResponse(error, "Could not update the commission");
  }
}
