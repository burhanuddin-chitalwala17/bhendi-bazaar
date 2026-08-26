/**
 * The only module that touches the payout tables (ADR-0003).
 *
 * Nothing here computes money — arithmetic lives in `commission.ts`, which is pure.
 * This module loads what that needs and stores what it returns.
 */

import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import type { ComputedLedgerLine, LedgerEntryComputation } from "@server/payouts/commission";
import { orderRepository } from "@server/checkout/order.repository";

export type PayoutDb = Pick<
  typeof prisma,
  "orgLedgerEntry" | "orgLedgerEntryLine" | "settlement" | "orgCommissionRule" | "org" | "orderItem"
>;

/** What one paid order contributes, per organisation. */
export interface OrderLineForLedger {
  orderItemId: string;
  orgId: string;
  categoryId: string;
  grossPaise: number;
  orgFundedPaise: number;
  platformFundedPaise: number;
}

export const ENTRY_WITH_LINES = {
  include: { lines: true },
} satisfies Prisma.OrgLedgerEntryDefaultArgs;

export class LedgerRepository {
  /**
   * An order's lines, flattened with everything the ledger needs.
   *
   * The funding split is read from the order line rather than recomputed from the
   * offer engine: rates and offers both move, and a settlement must read a fact
   * recorded when the order was paid (org-payouts D3).
   */
  async orderLines(orderId: string, db: PayoutDb = prisma): Promise<OrderLineForLedger[]> {
    const rows = await db.orderItem.findMany({
      where: { orderId },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        discountPaise: true,
        orgFundedPaise: true,
        product: { select: { orgId: true, categoryId: true } },
      },
    });

    return rows.map((row) => ({
      orderItemId: row.id,
      orgId: row.product.orgId,
      categoryId: row.product.categoryId,
      grossPaise: row.unitPrice * row.quantity,
      orgFundedPaise: row.orgFundedPaise,
      platformFundedPaise: row.discountPaise - row.orgFundedPaise,
    }));
  }

  /** An organisation's default rate and its category overrides. */
  async ratesFor(
    orgId: string,
    db: PayoutDb = prisma
  ): Promise<{ defaultBps: number; rules: Map<string, number> }> {
    const [org, rules] = await Promise.all([
      db.org.findUnique({ where: { id: orgId }, select: { commissionBps: true } }),
      db.orgCommissionRule.findMany({
        where: { orgId },
        select: { categoryId: true, rateBps: true },
      }),
    ]);
    return {
      defaultBps: org?.commissionBps ?? 1500,
      rules: new Map(rules.map((rule) => [rule.categoryId, rule.rateBps])),
    };
  }

  /** Has this order already produced an entry for this organisation? */
  async saleExists(orderId: string, orgId: string, db: PayoutDb = prisma): Promise<boolean> {
    const found = await db.orgLedgerEntry.findUnique({
      where: { orderId_orgId_kind: { orderId, orgId, kind: "SALE" } },
      select: { id: true },
    });
    return found !== null;
  }

  /** Write one organisation's entry and its per-line rates. */
  async createSale(
    input: { orgId: string; orderId: string; computation: LedgerEntryComputation },
    db: PayoutDb = prisma
  ) {
    const { computation: c } = input;
    return await db.orgLedgerEntry.create({
      data: {
        orgId: input.orgId,
        orderId: input.orderId,
        kind: "SALE",
        state: "DRAFT",
        grossItemsPaise: c.grossItemsPaise,
        orgFundedDiscountPaise: c.orgFundedDiscountPaise,
        platformFundedDiscountPaise: c.platformFundedDiscountPaise,
        commissionBasePaise: c.commissionBasePaise,
        commissionPaise: c.commissionPaise,
        payablePaise: c.payablePaise,
        isNegativeMargin: c.isNegativeMargin,
        lines: {
          create: c.lines.map((line: ComputedLedgerLine) => ({
            orderItemId: line.orderItemId,
            basePaise: line.basePaise,
            rateBps: line.rateBps,
            commissionPaise: line.commissionPaise,
          })),
        },
      },
      ...ENTRY_WITH_LINES,
    });
  }

  /**
   * An organisation's balances, summed by the database.
   *
   * Deliberately **not** a reduce over loaded rows: a balance is a property of every
   * entry an organisation has ever had, so computing it in JavaScript means fetching
   * the whole ledger on every page load and growing with each order forever. The two
   * figures differ (org-payouts D7), so they are two sums rather than one.
   */
  async balancesFor(orgId: string, db: PayoutDb = prisma) {
    const live = { orgId, deletedAt: null };
    const [unclaimed, owed] = await Promise.all([
      db.orgLedgerEntry.aggregate({
        where: { ...live, settlementId: null },
        _sum: { payablePaise: true },
      }),
      db.orgLedgerEntry.aggregate({
        where: {
          ...live,
          OR: [{ settlementId: null }, { settlement: { status: { not: "PAID" } } }],
        },
        _sum: { payablePaise: true },
      }),
    ]);
    return {
      unclaimedPaise: unclaimed._sum.payablePaise ?? 0,
      owedPaise: owed._sum.payablePaise ?? 0,
    };
  }

  /** How many of an organisation's entries were funded past what they earned (D12). */
  async negativeMarginCount(orgId: string, db: PayoutDb = prisma) {
    return await db.orgLedgerEntry.count({
      where: { orgId, deletedAt: null, isNegativeMargin: true },
    });
  }

  async countEntries(orgId: string, db: PayoutDb = prisma) {
    return await db.orgLedgerEntry.count({ where: { orgId, deletedAt: null } });
  }

  /** One page of an organisation's entries, newest first. */
  async entriesForOrg(
    orgId: string,
    { page = 1, limit = 25 }: { page?: number; limit?: number } = {},
    db: PayoutDb = prisma
  ) {
    const [entries, total] = await Promise.all([
      db.orgLedgerEntry.findMany({
        relationLoadStrategy: "join",
        where: { orgId },
        include: { lines: true, settlement: { select: { status: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.orgLedgerEntry.count({ where: { orgId } }),
    ]);
    return {
      entries,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async entryById(id: string, db: PayoutDb = prisma) {
    return await db.orgLedgerEntry.findUnique({ where: { id }, ...ENTRY_WITH_LINES });
  }

  /**
   * Paid orders that produced no ledger entry.
   *
   * The recording of an entry deliberately cannot fail a payment — the gateway has
   * already taken the money, so refusing to confirm an order over a bookkeeping row
   * would be the worse outcome. What that leaves is a gap, and a gap that exists only
   * in a log line is a gap nobody finds: an organisation simply is not credited.
   *
   * So the gap is a **query**, the same shape as the stuck-payment sweep that already
   * runs nightly. Anything this returns is money owed and unrecorded.
   */
  async paidOrdersMissingEntries(limit = 200): Promise<string[]> {
    return await orderRepository.findPaidWithoutLedgerEntries(limit);
  }

  /** How many, without fetching them — a capped list would report its own cap. */
  async countPaidOrdersMissingEntries(): Promise<number> {
    return await orderRepository.countPaidWithoutLedgerEntries();
  }
  // ── Maintenance ───────────────────────────────────────────────────────────

  /** An entry with the settlement status that decides whether it may be edited. */
  async entryWithSettlement(entryId: string, db: PayoutDb = prisma) {
    return await db.orgLedgerEntry.findUnique({
      relationLoadStrategy: "join",
      where: { id: entryId },
      include: { settlement: { select: { status: true } } },
    });
  }

  async updateEntry(
    entryId: string,
    data: Prisma.OrgLedgerEntryUncheckedUpdateInput,
    db: PayoutDb = prisma
  ) {
    return await db.orgLedgerEntry.update({ where: { id: entryId }, data, ...ENTRY_WITH_LINES });
  }

  /** Entries an organisation could still settle: unclaimed, and not removed. */
  async claimableEntries(orgId: string, entryIds: string[], db: PayoutDb = prisma) {
    return await db.orgLedgerEntry.findMany({
      where: { id: { in: entryIds }, orgId, deletedAt: null, settlementId: null },
      select: { id: true, payablePaise: true },
    });
  }

  async countSettlements(orgId: string, db: PayoutDb = prisma) {
    return await db.settlement.count({ where: { orgId } });
  }

  async createSettlement(data: Prisma.SettlementUncheckedCreateInput, db: PayoutDb = prisma) {
    return await db.settlement.create({ data });
  }

  async findSettlement(id: string, db: PayoutDb = prisma) {
    return await db.settlement.findUnique({ where: { id } });
  }

  async updateSettlement(
    id: string,
    data: Prisma.SettlementUncheckedUpdateInput,
    db: PayoutDb = prisma
  ) {
    return await db.settlement.update({ where: { id }, data });
  }

  async listSettlements(orgId: string, take = 20, db: PayoutDb = prisma) {
    return await db.settlement.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  /** Stamp entries into a settlement, or release them back. */
  async assignEntries(
    entryIds: string[],
    settlementId: string | null,
    state: "DRAFT" | "SETTLED",
    db: PayoutDb = prisma
  ) {
    await db.orgLedgerEntry.updateMany({
      where: settlementId === null ? { settlementId: { not: null } } : { id: { in: entryIds } },
      data: { settlementId, state },
    });
  }

  async releaseSettlementEntries(settlementId: string, db: PayoutDb = prisma) {
    await db.orgLedgerEntry.updateMany({
      where: { settlementId },
      data: { settlementId: null, state: "DRAFT" },
    });
  }

  /**
   * Replace an organisation's category rates.
   *
   * One transaction: a half-applied rate table would charge the wrong commission on
   * everything the missing rules covered, and nothing would look wrong.
   */
  async replaceCommissionRules(
    orgId: string,
    rules: Array<{ categoryId: string; rateBps: number }>
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.orgCommissionRule.deleteMany({ where: { orgId } });
      if (rules.length > 0) {
        await tx.orgCommissionRule.createMany({
          data: rules.map((rule) => ({ orgId, ...rule })),
        });
      }
    });
  }

  /** The same rules with their category ids, for the editor. */
  async commissionRulesWithIds(orgId: string, db: PayoutDb = prisma) {
    return await db.orgCommissionRule.findMany({
      where: { orgId },
      select: { categoryId: true, rateBps: true },
      orderBy: { rateBps: "asc" },
    });
  }

  /** An organisation's category rate overrides, for its own rates view. */
  async commissionRules(orgId: string, db: PayoutDb = prisma) {
    return await db.orgCommissionRule.findMany({
      where: { orgId },
      select: { rateBps: true, category: { select: { name: true } } },
      orderBy: { rateBps: "asc" },
    });
  }
}

export const ledgerRepository = new LedgerRepository();
