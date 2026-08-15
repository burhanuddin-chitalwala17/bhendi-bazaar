/**
 * GET /api/admin/payouts/orgs — every organisation's balances, plus anything unrecorded.
 *
 * `unrecorded` is the count of paid orders with no ledger entry. It should always be
 * zero; a non-zero figure is money owed that nothing has written, which is exactly the
 * gap a log line would have hidden (org-payouts D5).
 */
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { ledgerService } from "@server/payouts/ledger.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json(await ledgerService.overview());
  } catch (error) {
    return toErrorResponse(error, "Could not fetch payouts");
  }
}
