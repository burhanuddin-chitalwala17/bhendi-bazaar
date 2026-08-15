/** GET /api/admin/payouts/orgs/[orgId] — one organisation's ledger, entry by entry. */
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { ledgerService } from "@server/payouts/ledger.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(_request: Request, context: { params: Promise<{ orgId: string }> }) {
  try {
    await requirePlatformAdmin();
    const { orgId } = await context.params;
    return NextResponse.json(await ledgerService.platformView(orgId));
  } catch (error) {
    return toErrorResponse(error, "Could not fetch the ledger");
  }
}
