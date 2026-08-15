/**
 * GET /api/cron/reconcile-payments — invoked by Vercel Cron (vercel.json).
 *
 * The R6 backstop: a customer whose webhook was missed still gets their order
 * confirmed within the sweep interval. Guarded by CRON_SECRET, which Vercel sends as
 * a bearer token on cron invocations.
 */
import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import { ledgerService } from "@server/payouts/ledger.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await paymentService.reconcileStuckOrders();
    const recovered = results.filter((r) => r.outcome === "recovered").length;
    if (recovered > 0) {
      console.log(`Reconciliation recovered ${recovered} order(s)`, results);
    }

    // A ledger entry is deliberately not allowed to fail a payment, which leaves the
    // possibility of a paid order nobody was credited for. Recording it is idempotent,
    // so this simply writes whatever is missing — and reports it, because a gap that
    // keeps reappearing is a defect rather than a hiccup (org-payouts D5).
    const ledger = await ledgerService.backfillMissing();
    if (ledger.written > 0) {
      console.log(`Ledger backfill wrote ${ledger.written} entry(ies) across ${ledger.scanned} order(s)`);
    }

    return NextResponse.json({ checked: results.length, recovered, ledger, results });
  } catch (error) {
    return toErrorResponse(error, "Reconciliation failed");
  }
}
