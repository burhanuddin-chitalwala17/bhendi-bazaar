/**
 * The payouts domain's public surface (org-payouts D1).
 *
 * It writes rows nothing else may write, and reads order data through checkout rather
 * than reaching into it. Distinct from `analytics`, which only aggregates other
 * domains' tables and writes nothing.
 */

import { promotionRepository } from "@server/promotions/promotion.repository";
import {
  buyerPaidPaise,
  computeLedgerEntry,
  platformNetPaise,
  projectForOrg,
  type LedgerLineInput,
} from "@server/payouts/commission";
import { ledgerRepository, type PayoutDb } from "@server/payouts/ledger.repository";
import { orgRepository } from "@server/catalog/org.repository";
import { categoryRepository } from "@server/catalog/category.repository";
import type { CommercialTermsInput } from "@/lib/validation/schemas/commercial-terms.schema";
import { prisma } from "@server/shared/prisma";

export class LedgerService {
  /**
   * Record what each organisation earned from a paid order (D5).
   *
   * Called from the paid transition, never from order creation — an order that never
   * pays must never appear in a payout. Idempotent on `(order, org, SALE)`, so a
   * replayed confirmation cannot pay an organisation twice.
   */
  async recordSale(orderId: string, db: PayoutDb = prisma): Promise<number> {
    const lines = await ledgerRepository.orderLines(orderId, db);
    if (lines.length === 0) return 0;

    const parents = await promotionRepository.categoryParents(prisma);

    // One entry per organisation: a multi-org order is partitioned, with nothing
    // shared and nothing counted twice.
    const byOrg = new Map<string, typeof lines>();
    for (const line of lines) {
      const bucket = byOrg.get(line.orgId) ?? [];
      bucket.push(line);
      byOrg.set(line.orgId, bucket);
    }

    let written = 0;
    for (const [orgId, orgLines] of byOrg) {
      if (await ledgerRepository.saleExists(orderId, orgId, db)) continue;

      const { defaultBps, rules } = await ledgerRepository.ratesFor(orgId, db);
      const computation = computeLedgerEntry({
        lines: orgLines.map(
          (line): LedgerLineInput => ({
            orderItemId: line.orderItemId,
            categoryId: line.categoryId,
            grossPaise: line.grossPaise,
            orgFundedPaise: line.orgFundedPaise,
          })
        ),
        platformFundedPaise: orgLines.reduce((sum, l) => sum + l.platformFundedPaise, 0),
        parents,
        rules,
        orgDefaultBps: defaultBps,
      });

      await ledgerRepository.createSale({ orgId, orderId, computation }, db);
      written += 1;
    }

    return written;
  }

  /**
   * Write the entries that should exist and do not.
   *
   * The backstop for a ledger write that failed after payment (D5). Safe to run at
   * any time because `recordSale` is idempotent per `(order, org)`, and cheap because
   * the query returns nothing once the ledger is whole.
   */
  async backfillMissing(limit = 200): Promise<{ scanned: number; written: number }> {
    const orderIds = await ledgerRepository.paidOrdersMissingEntries(limit);
    let written = 0;
    for (const orderId of orderIds) {
      try {
        written += await this.recordSale(orderId);
      } catch (error) {
        console.error(`[payouts] backfill failed for order ${orderId}`, error);
      }
    }
    return { scanned: orderIds.length, written };
  }

  /** How much is owed but unrecorded — zero unless a write failed (D5). */
  async unrecordedCount(): Promise<number> {
    return await ledgerRepository.countPaidOrdersMissingEntries();
  }

  /**
   * Set what the platform charges an organisation (R12, R13).
   *
   * Existing ledger entries are untouched by design: every rate is snapshotted onto
   * the line that used it, so changing a rate today cannot alter what was settled
   * yesterday (R4). Percent → basis points happens here, the same seam the product
   * and offer forms use.
   */
  async setCommercialTerms(orgId: string, input: CommercialTermsInput) {
    await orgRepository.updateCommercialTerms(orgId, {
      commissionBps: Math.round(input.commissionPercent * 100),
      maxDiscountBps: Math.round(input.maxDiscountPercent * 100),
    });
    await ledgerRepository.replaceCommissionRules(
      orgId,
      input.categoryRates.map((rate) => ({
        categoryId: rate.categoryId,
        rateBps: Math.round(rate.ratePercent * 100),
      }))
    );
  }

  /**
   * Every organisation's balances — the payout overview.
   *
   * Four aggregates per organisation rather than its whole ledger: this page used to
   * load every entry ever written, for every organisation, to add up two numbers.
   */
  async overview() {
    const orgs = await orgRepository.listCommercialTerms();
    const rows = await Promise.all(
      orgs.map(async (org) => {
        const [balance, entryCount, negativeMarginOrders] = await Promise.all([
          ledgerRepository.balancesFor(org.id),
          ledgerRepository.countEntries(org.id),
          ledgerRepository.negativeMarginCount(org.id),
        ]);
        return { ...org, ...balance, entryCount, negativeMarginOrders };
      })
    );
    return { orgs: rows, unrecorded: await this.unrecordedCount() };
  }

  /** One organisation's ledger, plus who they are and what has been settled. */
  async platformViewWithContext(orgId: string, page = 1) {
    const [org, view, settlements, categoryRules, categories] = await Promise.all([
      orgRepository.findCommercialTerms(orgId),
      this.platformView(orgId, page),
      ledgerRepository.listSettlements(orgId),
      ledgerRepository.commissionRulesWithIds(orgId),
      categoryRepository.listForPicker(),
    ]);
    return { org, ...view, settlements, categoryRules, categories };
  }

  /** Everything an organisation sees about itself, rates and settlements included. */
  async orgViewWithContext(orgId: string, page = 1) {
    const [earnings, org, categoryRates, settlements] = await Promise.all([
      this.orgView(orgId, page),
      orgRepository.findCommercialTerms(orgId),
      ledgerRepository.commissionRules(orgId),
      ledgerRepository.listSettlements(orgId),
    ]);
    return {
      ...earnings,
      defaultBps: org?.commissionBps ?? 1500,
      categoryRates,
      settlements,
    };
  }

  /** What the platform sees for one organisation: both balances and its entries. */
  async platformView(orgId: string, page = 1) {
    // Balances are summed by the database; only the visible page is fetched.
    const [balance, { entries, pagination }] = await Promise.all([
      ledgerRepository.balancesFor(orgId),
      ledgerRepository.entriesForOrg(orgId, { page }),
    ]);

    return {
      ...balance,
      pagination,
      entries: entries.map((entry) => ({
        id: entry.id,
        orderId: entry.orderId,
        kind: entry.kind,
        state: entry.state,
        buyerPaidPaise: buyerPaidPaise(entry),
        payablePaise: entry.payablePaise,
        commissionPaise: entry.commissionPaise,
        campaignCostPaise: entry.platformFundedDiscountPaise,
        platformNetPaise: platformNetPaise(entry),
        isNegativeMargin: entry.isNegativeMargin,
        isManuallyEdited: entry.isManuallyEdited,
        deletedAt: entry.deletedAt,
        settlementStatus: entry.settlement?.status ?? null,
        createdAt: entry.createdAt,
      })),
    };
  }

  /**
   * What an organisation sees for itself (D13).
   *
   * A projection of the same rows the platform reads, never a second calculation —
   * recomputing an organisation's earnings for its own screen is how two audiences
   * come to see two numbers for one order. It discloses the platform's contribution
   * (D13a), because an organisation credited on more than the buyer paid is otherwise
   * looking at an unexplained gap.
   */
  async orgView(orgId: string, page = 1) {
    const [balance, { entries, pagination }] = await Promise.all([
      ledgerRepository.balancesFor(orgId),
      ledgerRepository.entriesForOrg(orgId, { page }),
    ]);
    const visible = entries.filter((entry) => entry.deletedAt === null);

    return {
      ...balance,
      pagination,
      orders: visible.map((entry) => ({
        id: entry.id,
        orderId: entry.orderId,
        createdAt: entry.createdAt,
        settlementStatus: entry.settlement?.status ?? null,
        ...projectForOrg(entry),
      })),
    };
  }
}

export const ledgerService = new LedgerService();
