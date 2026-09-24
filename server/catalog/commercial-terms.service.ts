import { orgRepository } from "@server/catalog/org.repository";

/**
 * What the platform charges an organisation.
 *
 * The rate lives on the `Org` row, which `catalog` owns, but nothing in catalog uses it:
 * `payouts` reads it to compute a ledger entry and `promotions` reads it to cap a discount.
 * Both reached `org.repository` directly until now — past the service that owns the rules,
 * which [ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)
 * forbids.
 *
 * A module of its own rather than three more methods on `org.service`, because this is a
 * concept with a life beyond the row it is stored on — a base rate, per-category overrides in
 * `OrgCommissionRule`, and a ceiling on what an offer may give away. `org.service` answers
 * "what is this organisation"; this answers "what does it cost to sell here", and keeping them
 * apart is what stops the first becoming the home for anything attached to an `Org`.
 */
export const commercialTermsService = {
  /** This org's rate and discount ceiling, or null if the org is gone. */
  find: (orgId: string) => orgRepository.findCommercialTerms(orgId),

  /** Every org's rate, for the console's comparison view. */
  list: () => orgRepository.listCommercialTerms(),

  /**
   * Set the rate and the ceiling ([org-payouts](../../docs/specs/org-payouts/) R12, R13).
   * Both move together because a ceiling without a rate is unenforceable and a rate without a
   * ceiling lets an offer give away more than the margin it is funded from.
   */
  update: (orgId: string, terms: { commissionBps: number; maxDiscountBps: number }) =>
    orgRepository.updateCommercialTerms(orgId, terms),
};
