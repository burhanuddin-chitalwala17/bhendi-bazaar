/**
 * GET /api/org/[orgId]/earnings — what this organisation has earned.
 *
 * Read-only, and refused at the handler rather than merely absent from the screen
 * (org-payouts D14): there is no POST, PATCH or DELETE here, so a write has nothing to
 * reach. `orgId` comes from the route through `withOrg`, never from a body or a query
 * string, which is what keeps one organisation out of another's ledger.
 *
 * The projection discloses what the platform funded (D13a). Hiding it does not work —
 * an organisation knows its own storefront price and its own offer — and it removes
 * the one fact that makes the commission base legible.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { ledgerService } from "@server/payouts/ledger.service";

export const GET = withOrg(async (_request, scope) =>
  NextResponse.json(await ledgerService.orgViewWithContext(scope.orgId))
);
