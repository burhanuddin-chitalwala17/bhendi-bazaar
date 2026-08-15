/**
 * What an organisation earned and what the platform kept (org-payouts D2, D4).
 *
 * Pure, like the offer engine: the ledger's arithmetic is the thing an organisation
 * will query, so it has to be testable without a database and reproducible from the
 * same inputs a year later.
 *
 * The decision this file exists to enforce: **commission is charged on what the
 * organisation's goods earned after the organisation's own discount, and before any
 * discount the platform chose to fund.** Basing it on what the buyer paid would
 * quietly make the organisation co-fund the platform's campaign.
 */

import { applyBps } from "@server/promotions/allocation";
import { categoryAncestry, type CategoryParents } from "@server/promotions/targeting";

/** `categoryId -> rateBps`, an org's overrides of its own default. */
export type CommissionRules = ReadonlyMap<string, number>;

/**
 * The rate for one item: the nearest ancestor category carrying a rule, else the
 * organisation's default (D4b).
 *
 * Unambiguous because a product sits in exactly one category, so it has one ancestry
 * and therefore one rate. Nearest-wins is what lets a rate on a parent mean "unless a
 * child says otherwise" with no precedence field to configure.
 */
export function resolveRateBps(
  categoryId: string,
  parents: CategoryParents,
  rules: CommissionRules,
  orgDefaultBps: number
): number {
  for (const ancestor of categoryAncestry(categoryId, parents)) {
    const rate = rules.get(ancestor);
    if (rate !== undefined) return rate;
  }
  return orgDefaultBps;
}

/** One order line's contribution to an organisation's entry. */
export interface LedgerLineInput {
  orderItemId: string;
  categoryId: string;
  /** `unitPrice * quantity` — the list value of the goods, before any discount. */
  grossPaise: number;
  /** The part of this line's discount the organisation bore. */
  orgFundedPaise: number;
}

export interface ComputedLedgerLine {
  /** Null on a manual adjustment's line, which has no order behind it (spec R5). */
  orderItemId: string | null;
  basePaise: number;
  rateBps: number;
  commissionPaise: number;
}

export interface LedgerEntryComputation {
  grossItemsPaise: number;
  orgFundedDiscountPaise: number;
  platformFundedDiscountPaise: number;
  commissionBasePaise: number;
  commissionPaise: number;
  payablePaise: number;
  /** True when the platform funded more than it earned here (D12). */
  isNegativeMargin: boolean;
  lines: ComputedLedgerLine[];
}

/**
 * Compute one organisation's entry for one order.
 *
 * Commission is summed per line rather than taken on the total, because rates resolve
 * per item and one entry can carry several (D4c). That is also why the rate lives on
 * the line and not on the entry — for an order spanning two categories there is no
 * single "the organisation's rate".
 */
export function computeLedgerEntry(input: {
  lines: readonly LedgerLineInput[];
  /** Total the platform funded across these lines. Excluded from the base. */
  platformFundedPaise: number;
  parents: CategoryParents;
  rules: CommissionRules;
  orgDefaultBps: number;
}): LedgerEntryComputation {
  const lines: ComputedLedgerLine[] = input.lines.map((line) => {
    const basePaise = line.grossPaise - line.orgFundedPaise;
    const rateBps = resolveRateBps(line.categoryId, input.parents, input.rules, input.orgDefaultBps);
    return {
      orderItemId: line.orderItemId,
      basePaise,
      rateBps,
      commissionPaise: applyBps(basePaise, rateBps),
    };
  });

  const grossItemsPaise = input.lines.reduce((s, l) => s + l.grossPaise, 0);
  const orgFundedDiscountPaise = input.lines.reduce((s, l) => s + l.orgFundedPaise, 0);
  const commissionBasePaise = lines.reduce((s, l) => s + l.basePaise, 0);
  const commissionPaise = lines.reduce((s, l) => s + l.commissionPaise, 0);
  const payablePaise = commissionBasePaise - commissionPaise;

  return {
    grossItemsPaise,
    orgFundedDiscountPaise,
    platformFundedDiscountPaise: input.platformFundedPaise,
    commissionBasePaise,
    commissionPaise,
    payablePaise,
    isNegativeMargin: commissionPaise - input.platformFundedPaise < 0,
    lines,
  };
}

/**
 * What the platform is left with on an entry: its commission, less whatever it chose
 * to fund. Goes negative when it outbids an organisation more deeply than it earns —
 * a real outcome, and always the platform's own decision.
 */
export function platformNetPaise(entry: {
  commissionPaise: number;
  platformFundedDiscountPaise: number;
}): number {
  return entry.commissionPaise - entry.platformFundedDiscountPaise;
}

/** What the buyer actually paid for the goods in an entry. */
export function buyerPaidPaise(entry: {
  grossItemsPaise: number;
  orgFundedDiscountPaise: number;
  platformFundedDiscountPaise: number;
}): number {
  return (
    entry.grossItemsPaise - entry.orgFundedDiscountPaise - entry.platformFundedDiscountPaise
  );
}

/** What an organisation is shown for one order (D13). */
export interface OrgEarningsProjection {
  grossItemsPaise: number;
  orgFundedDiscountPaise: number;
  /** Null when the platform funded nothing — the section is omitted rather than zeroed. */
  platformContributionPaise: number | null;
  buyerPaidPaise: number;
  commissionPaise: number;
  payablePaise: number;
  rates: ComputedLedgerLine[];
}

/**
 * Project a written entry onto what its organisation sees.
 *
 * A projection, never a second calculation (D13): it reads `payable` and the lines
 * exactly as stored, because recomputing an organisation's earnings from prices for
 * its own screen is how two audiences come to see two numbers for one order.
 *
 * It discloses the platform's contribution rather than hiding it (D13a) — without it,
 * an organisation credited on more than the buyer paid is looking at an unexplained
 * gap, which reads as an error rather than as the platform having spent to move stock.
 */
export function projectForOrg(entry: {
  grossItemsPaise: number;
  orgFundedDiscountPaise: number;
  platformFundedDiscountPaise: number;
  commissionPaise: number;
  payablePaise: number;
  lines: readonly ComputedLedgerLine[];
}): OrgEarningsProjection {
  return {
    grossItemsPaise: entry.grossItemsPaise,
    orgFundedDiscountPaise: entry.orgFundedDiscountPaise,
    platformContributionPaise:
      entry.platformFundedDiscountPaise > 0 ? entry.platformFundedDiscountPaise : null,
    buyerPaidPaise: buyerPaidPaise(entry),
    commissionPaise: entry.commissionPaise,
    payablePaise: entry.payablePaise,
    rates: [...entry.lines],
  };
}
