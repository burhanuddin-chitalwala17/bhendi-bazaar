/**
 * The only module that touches the payout tables (ADR-0003).
 *
 * Nothing here computes money — arithmetic lives in `commission.ts`, which is pure.
 * This module loads what that needs and stores what it returns.
 */

import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import type {
  ComputedLedgerLine,
  LedgerEntryComputation,
  LedgerHeader,
  ParcelReversal,
  ReversibleLine,
} from "@server/payouts/commission";

export type PayoutDb = Pick<
  typeof prisma,
  | "orgLedgerEntry"
  | "orgLedgerEntryLine"
  | "settlement"
  | "orgCommissionRule"
  | "org"
  | "orderItem"
  | "$queryRaw"
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
    const found = await db.orgLedgerEntry.findFirst({
      where: { orderId, orgId, kind: "SALE" },
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
   * Lock the org's sale on an order until the transaction ends (offers-hardening D1). Two parcels
   * of one line reversed at once would each read the same reversed quantity and lose a paisa;
   * one parcel twice would hit the unique index and abort the shared transaction. Meaningless
   * outside a transaction.
   */
  async lockSale(orderId: string, orgId: string, db: PayoutDb): Promise<void> {
    await db.$queryRaw`SELECT id FROM "OrgLedgerEntry"
      WHERE "orderId" = ${orderId} AND "orgId" = ${orgId} AND kind = 'SALE' FOR UPDATE`;
  }

  async parcelReversed(shipmentId: string, db: PayoutDb = prisma): Promise<boolean> {
    const found = await db.orgLedgerEntry.findFirst({
      where: { shipmentId, kind: "REVERSAL" },
      select: { id: true },
    });
    return found !== null;
  }

  /**
   * An org's live sale on an order — header, whether an admin edited it, and each line with the
   * quantities already reversed. Null when there is no live sale. A soft-deleted entry no longer
   * counts toward a balance, so it counts toward nothing here either.
   */
  async reversibleSale(
    orderId: string,
    orgId: string,
    db: PayoutDb = prisma
  ): Promise<{
    header: LedgerHeader;
    isManuallyEdited: boolean;
    lines: Map<string, { line: ReversibleLine; prior: (number | null)[] }>;
  } | null> {
    const entries = await db.orgLedgerEntry.findMany({
      where: { orderId, orgId, kind: { in: ["SALE", "REVERSAL"] }, deletedAt: null },
      select: {
        kind: true,
        isManuallyEdited: true,
        grossItemsPaise: true,
        orgFundedDiscountPaise: true,
        platformFundedDiscountPaise: true,
        commissionBasePaise: true,
        commissionPaise: true,
        payablePaise: true,
        lines: {
          select: {
            orderItemId: true,
            basePaise: true,
            rateBps: true,
            commissionPaise: true,
            quantity: true,
            orderItem: {
              select: { quantity: true, discountPaise: true, orgFundedPaise: true },
            },
          },
        },
      },
    });
    const sale = entries.find((e) => e.kind === "SALE");
    if (!sale) return null;

    const byItem = new Map<string, { line: ReversibleLine; prior: (number | null)[] }>();
    for (const l of sale.lines) {
      if (!l.orderItemId || !l.orderItem) continue;
      byItem.set(l.orderItemId, {
        line: {
          orderItemId: l.orderItemId,
          quantity: l.orderItem.quantity,
          orgFundedPaise: l.orderItem.orgFundedPaise,
          platformFundedPaise: l.orderItem.discountPaise - l.orderItem.orgFundedPaise,
          basePaise: l.basePaise,
          rateBps: l.rateBps,
          commissionPaise: l.commissionPaise,
        },
        prior: [],
      });
    }
    for (const e of entries) {
      if (e.kind !== "REVERSAL") continue;
      for (const l of e.lines) {
        if (l.orderItemId) byItem.get(l.orderItemId)?.prior.push(l.quantity);
      }
    }
    return {
      header: {
        grossItemsPaise: sale.grossItemsPaise,
        orgFundedDiscountPaise: sale.orgFundedDiscountPaise,
        platformFundedDiscountPaise: sale.platformFundedDiscountPaise,
        commissionBasePaise: sale.commissionBasePaise,
        commissionPaise: sale.commissionPaise,
        payablePaise: sale.payablePaise,
      },
      isManuallyEdited: sale.isManuallyEdited,
      lines: byItem,
    };
  }

  /**
   * Write one parcel's reversal, every figure negated, never editing the sale
   * ([ADR-0020](../../docs/adr/0020-money-bearing-records-never-cascade.md)). The caller holds
   * `lockSale`; the one-REVERSAL-per-`shipmentId` index is the backstop.
   */
  async createParcelReversal(
    input: { orgId: string; orderId: string; shipmentId: string; note: string; reversal: ParcelReversal },
    db: PayoutDb = prisma
  ) {
    const { reversal: r } = input;
    return await db.orgLedgerEntry.create({
      data: {
        orgId: input.orgId,
        orderId: input.orderId,
        shipmentId: input.shipmentId,
        kind: "REVERSAL",
        state: "DRAFT",
        grossItemsPaise: -r.grossItemsPaise,
        orgFundedDiscountPaise: -r.orgFundedDiscountPaise,
        platformFundedDiscountPaise: -r.platformFundedDiscountPaise,
        commissionBasePaise: -r.commissionBasePaise,
        commissionPaise: -r.commissionPaise,
        payablePaise: -r.payablePaise,
        // A negated payable is not a negative *margin* — that flag describes a sale whose
        // commission exceeded what the org earned, which a reversal is not.
        isNegativeMargin: false,
        note: input.note,
        lines: {
          create: r.lines.map((line) => ({
            orderItemId: line.orderItemId,
            quantity: line.quantity,
            basePaise: -line.basePaise,
            rateBps: line.rateBps,
            commissionPaise: -line.commissionPaise,
          })),
        },
      },
      ...ENTRY_WITH_LINES,
    });
  }

  /**
   * Charge a shop for cancelling a paid parcel (order-fulfilment D14): payable = −fee, the fee as
   * it stood, copied. The one-fee-per-parcel partial index makes a repeat write nothing; answers
   * whether this call wrote it.
   */
  async createCancellationFee(
    input: { orgId: string; orderId: string; shipmentId: string; feePaise: number; note: string },
    db: PayoutDb = prisma
  ): Promise<boolean> {
    const written = await db.orgLedgerEntry.createMany({
      data: [{
        orgId: input.orgId,
        orderId: input.orderId,
        shipmentId: input.shipmentId,
        kind: "CANCELLATION_FEE",
        state: "DRAFT",
        grossItemsPaise: 0,
        orgFundedDiscountPaise: 0,
        platformFundedDiscountPaise: 0,
        commissionBasePaise: 0,
        commissionPaise: 0,
        payablePaise: -input.feePaise,
        note: input.note,
      }],
      skipDuplicates: true,
    });
    return written.count === 1;
  }

  /** The fee each of these parcels' cancels charged, paise; parcels with none are absent. */
  async cancellationFeesForParcels(shipmentIds: string[], db: PayoutDb = prisma): Promise<Map<string, number>> {
    if (shipmentIds.length === 0) return new Map();
    const rows = await db.orgLedgerEntry.findMany({
      where: { shipmentId: { in: shipmentIds }, kind: "CANCELLATION_FEE", deletedAt: null },
      select: { shipmentId: true, payablePaise: true },
    });
    return new Map(rows.flatMap((r) => (r.shipmentId ? [[r.shipmentId, -r.payablePaise] as const] : [])));
  }

  /** Cancellation fees per shop since `since`, paise (ux.md "Zari Works · 4 cancelled · ₹200 fees"). */
  async cancellationFeesByOrg(orgIds: string[], since: Date, db: PayoutDb = prisma): Promise<Map<string, number>> {
    if (orgIds.length === 0) return new Map();
    const rows = await db.orgLedgerEntry.groupBy({
      by: ["orgId"],
      where: { orgId: { in: orgIds }, kind: "CANCELLATION_FEE", deletedAt: null, createdAt: { gte: since } },
      _sum: { payablePaise: true },
      orderBy: { orgId: "asc" },
    });
    return new Map(rows.map((r) => [r.orgId, -(r._sum?.payablePaise ?? 0)]));
  }

  /**
   * The org's unsettled negative entries outside `entryIds` (order-fulfilment D15, Q34): a
   * settlement leaving any behind would pay the positives and strand the debt.
   */
  async unsettledNegativesOutside(orgId: string, entryIds: string[], db: PayoutDb = prisma) {
    return await db.orgLedgerEntry.count({
      where: { orgId, deletedAt: null, settlementId: null, payablePaise: { lt: 0 }, id: { notIn: entryIds } },
    });
  }

  /**
   * Write an entry the order flow did not produce (spec R5).
   *
   * A bidding sale is the first caller: the money was collected off the platform, so
   * there is no order to derive the entry from and no `orderId` to make it idempotent
   * against. What makes it safe to write exactly once lives with the caller — for
   * bidding, the guarded transition to SOLD in the same transaction.
   *
   * `isManuallyEdited` stays false: the figures were not edited away from an order's,
   * they never had one (payouts D9b).
   */
  async createAdjustment(
    input: { orgId: string; computation: LedgerEntryComputation; note: string },
    db: PayoutDb = prisma
  ) {
    const { computation: c } = input;
    return await db.orgLedgerEntry.create({
      data: {
        orgId: input.orgId,
        orderId: null,
        kind: "ADJUSTMENT",
        state: "DRAFT",
        note: input.note,
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

  /**
   * The overview's balances for every organisation at once, keyed by orgId.
   *
   * The O(1) replacement for calling `balancesFor` per organisation: the overview was
   * 4N+2 queries and grew with each org onboarded. The two figures use different
   * filters (org-payouts D7), so they stay two grouped sums — but two, not two-per-org.
   * An org with no entries is simply absent from the maps; the caller defaults to 0,
   * exactly as an empty aggregate did.
   */
  async balancesByOrg(db: PayoutDb = prisma) {
    const live = { deletedAt: null };
    const [unclaimed, owed] = await Promise.all([
      db.orgLedgerEntry.groupBy({
        by: ["orgId"],
        where: { ...live, settlementId: null },
        _sum: { payablePaise: true },
      }),
      db.orgLedgerEntry.groupBy({
        by: ["orgId"],
        where: {
          ...live,
          OR: [{ settlementId: null }, { settlement: { status: { not: "PAID" } } }],
        },
        _sum: { payablePaise: true },
      }),
    ]);
    return {
      unclaimedByOrg: new Map(unclaimed.map((r) => [r.orgId, r._sum.payablePaise ?? 0])),
      owedByOrg: new Map(owed.map((r) => [r.orgId, r._sum.payablePaise ?? 0])),
    };
  }

  /** Entry counts — total and negative-margin — for every organisation, grouped. */
  async entryCountsByOrg(db: PayoutDb = prisma) {
    const [all, negative] = await Promise.all([
      db.orgLedgerEntry.groupBy({
        by: ["orgId"],
        where: { deletedAt: null },
        _count: true,
      }),
      db.orgLedgerEntry.groupBy({
        by: ["orgId"],
        where: { deletedAt: null, isNegativeMargin: true },
        _count: true,
      }),
    ]);
    return {
      entryCountByOrg: new Map(all.map((r) => [r.orgId, r._count])),
      negativeMarginByOrg: new Map(negative.map((r) => [r.orgId, r._count])),
    };
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
      relationLoadStrategy: "join",
    });
  }
}

export const ledgerRepository = new LedgerRepository();
