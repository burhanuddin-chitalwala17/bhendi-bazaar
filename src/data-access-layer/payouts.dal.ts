/**
 * Payout reads for server components.
 *
 * A cache wrapper over the payouts service — the domain owns the queries, this owns
 * per-request deduplication so several components on one page share one lookup.
 * Both audiences read the same rows through the same service; the organisation's
 * figures are a projection, never a second calculation (org-payouts D13).
 */

import { cache } from "react";
import { ledgerService } from "@server/payouts/ledger.service";

export const payoutsDAL = {
  /** Every organisation's balances, plus anything paid but unrecorded. */
  overview: cache(() => ledgerService.overview()),

  /** One organisation's ledger, and who they are. */
  forOrg: cache((orgId: string) => ledgerService.platformViewWithContext(orgId)),

  /** What an organisation sees about itself — read-only, and its own records only. */
  earningsFor: cache((orgId: string) => ledgerService.orgViewWithContext(orgId)),
};
