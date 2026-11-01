/**
 * The only module that touches `prisma.promotion` (ADR-0003).
 *
 * Every read here returns the shape the pure engine wants, so the engine never learns
 * what Prisma is and stays testable without a database.
 */

import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import type { EnginePromotion } from "@server/promotions/promotion.types";
import type { CategoryParents } from "@server/promotions/targeting";
import type { StorefrontOfferRow } from "@server/promotions/storefront-offers";

/**
 * Anything that can run these queries — the client, or a transaction handle. Named
 * so callers inside `$transaction` pass `tx` and get the same guarantees.
 */
export type PromotionDb = Pick<typeof prisma, "promotion" | "category" | "orderDiscount">;
type Db = PromotionDb;
/** A transaction handle — the only thing a row lock means anything inside. */
export type PromotionTx = Prisma.TransactionClient;

const PROMOTION_SELECT = {
  id: true,
  label: true,
  scope: true,
  orgId: true,
  trigger: true,
  code: true,
  valueType: true,
  percentBps: true,
  amountOffPaise: true,
  fixedPricePaise: true,
  maxDiscountPaise: true,
  minSubtotalPaise: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  usageLimit: true,
  usageCount: true,
  perUserLimit: true,
  platformBudgetPaise: true,
  platformSpentPaise: true,
  targets: { select: { categoryId: true, productId: true } },
} satisfies Prisma.PromotionSelect;

export class PromotionRepository {
  /**
   * Every offer that could apply right now.
   *
   * Deliberately one query returning the whole live set rather than a query per
   * product: since automatic offers set displayed prices, this read sits on every
   * listing render, and a per-product query there would be fatal (promotions D12).
   * The set is small — live campaigns are coarse and few.
   */
  async listLive(now: Date, db: Db = prisma): Promise<EnginePromotion[]> {
    // Joined, not queried per relation: this read is on every storefront render,
    // so its targets sub-read was a second billed operation per page.
    return await db.promotion.findMany({
      relationLoadStrategy: "join",
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      select: PROMOTION_SELECT,
    });
  }

  /**
   * One shop's running offers with what each covers named, for its deals section (storefront-themes
   * D10). Which of them show is `storefrontOffers`' policy; this only scopes to the shop and the clock.
   */
  async listRunningForOrg(orgId: string, now: Date, db: Db = prisma): Promise<StorefrontOfferRow[]> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- swapped for named targets below
    const { targets: _targets, ...fields } = PROMOTION_SELECT;
    const rows = await db.promotion.findMany({
      relationLoadStrategy: "join",
      where: { scope: "ORG", orgId, isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      select: {
        ...fields,
        showOnStorefront: true,
        targets: { select: { category: { select: { name: true } }, product: { select: { name: true } } } },
      },
    });
    return rows.map((row) => ({
      ...row,
      targets: row.targets.map((t) => ({ categoryName: t.category?.name ?? null, productName: t.product?.name ?? null })),
    }));
  }

  /**
   * One code, live or not.
   *
   * Returns expired and exhausted offers too, so the engine can tell a buyer *why*
   * their code did nothing instead of reporting it as unrecognised.
   */
  async findByCode(code: string, db: Db = prisma): Promise<EnginePromotion | null> {
    return await db.promotion.findUnique({ where: { code }, select: PROMOTION_SELECT });
  }


  /**
   * Hold this code's row until the transaction ends; no-op for an unknown code (offers-hardening D3).
   * A second checkout waits here, then counts the buyer's redemptions with the first one committed.
   */
  async lockByCode(code: string, tx: PromotionTx): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Promotion" WHERE code = ${code} FOR UPDATE`;
  }

  /** The whole category tree as `id -> parentId`. One small table; read whole. */
  async categoryParents(db: Db = prisma): Promise<CategoryParents> {
    const rows = await db.category.findMany({ select: { id: true, parentId: true } });
    return new Map(rows.map((row) => [row.id, row.parentId]));
  }

  /**
   * Claim one use of a limited offer, or refuse (promotions D11, ADR-0007).
   *
   * The availability check **is** the write's `where` clause, so the database decides
   * and there is no window between checking and incrementing. `false` means the offer
   * was exhausted by someone else first — read-then-write here would oversell a
   * "first 100 customers" coupon exactly as it oversells stock.
   *
   * Runs inside the order transaction, so a failed order releases the claim by
   * rolling back rather than by remembering to.
   */
  async claimUse(promotionId: string, tx: Db): Promise<boolean> {
    const claimed = await tx.promotion.updateMany({
      where: {
        id: promotionId,
        OR: [{ usageLimit: null }, { usageCount: { lt: prisma.promotion.fields.usageLimit } }],
      },
      data: { usageCount: { increment: 1 } },
    });
    return claimed.count === 1;
  }

  /**
   * Give a claim back when an order expires unpaid.
   *
   * Guarded so a counter cannot go below zero, for the same reason stock's decrement
   * is guarded: a released claim that was never made would hand out a free use.
   */
  async releaseUse(promotionId: string, db: Db = prisma): Promise<void> {
    await db.promotion.updateMany({
      where: { id: promotionId, usageCount: { gt: 0 } },
      data: { usageCount: { decrement: 1 } },
    });
  }

  /**
   * Spend part of a platform offer's budget, or refuse (offers-hardening D5).
   *
   * The budget check is the update's `WHERE`, exactly as `claimUse`'s is, so two orders racing
   * for the last of it cannot both fit. `false` means it would pass the budget.
   */
  async spendBudget(promotionId: string, amountPaise: number, tx: PromotionTx): Promise<boolean> {
    const updated = await tx.$executeRaw`
      UPDATE "Promotion"
      SET "platformSpentPaise" = "platformSpentPaise" + ${amountPaise}
      WHERE id = ${promotionId}
        AND "platformBudgetPaise" IS NOT NULL
        AND "platformSpentPaise" + ${amountPaise} <= "platformBudgetPaise"`;
    return updated === 1;
  }

  /**
   * Give back exactly what an expiring order charged each budget — its rows' `budgetChargedPaise`,
   * whatever the budget became since. The floor at zero is a backstop, not the rule.
   */
  async releaseBudgetForOrder(orderId: string, tx: PromotionTx): Promise<void> {
    const charged = await tx.orderDiscount.groupBy({
      by: ["promotionId"],
      where: { orderId, budgetChargedPaise: { gt: 0 } },
      _sum: { budgetChargedPaise: true },
      orderBy: { promotionId: "asc" },
    });
    for (const row of charged) {
      // The order-level release row is the record (order-fulfilment D13): its key refuses a second.
      await this.releaseBudget({ promotionId: row.promotionId, orderId, shipmentId: null, amountPaise: row._sum?.budgetChargedPaise ?? 0 }, tx);
    }
  }

  /**
   * Give `amountPaise` back to an offer's budget once (order-fulfilment D13, Q10): the release row
   * is inserted first, and only a row that was new gives anything back. Its unique key — per parcel
   * and offer, or per order and offer for an expiry — is what makes a repeat cancel release nothing.
   */
  async releaseBudget(
    release: { promotionId: string; orderId: string; shipmentId: string | null; amountPaise: number },
    tx: PromotionTx,
  ): Promise<boolean> {
    if (release.amountPaise <= 0) return false;
    const written = await tx.promotionBudgetRelease.createMany({ data: [release], skipDuplicates: true });
    if (written.count !== 1) return false;
    await tx.$executeRaw`
      UPDATE "Promotion"
      SET "platformSpentPaise" = GREATEST("platformSpentPaise" - ${release.amountPaise}, 0)
      WHERE id = ${release.promotionId}`;
    return true;
  }

  /** What each offer charged this order's budget, per shop it landed on (Q33's input). */
  async budgetChargesForOrder(orderId: string, tx: PromotionTx) {
    return await tx.orderDiscount.findMany({
      where: { orderId, budgetChargedPaise: { gt: 0 } },
      orderBy: [{ promotionId: "asc" }, { orgId: "asc" }],
      select: { promotionId: true, orgId: true, budgetChargedPaise: true },
    });
  }

  /**
   * Lock the offers this order used, before a cancel moves stock (order-fulfilment D2): checkout
   * and expiry take Promotion before stock, so a cancel releasing budget after its restock must
   * already hold these rows, or the two orders of locking could deadlock.
   */
  async lockForOrder(orderId: string, tx: PromotionTx): Promise<void> {
    await tx.$queryRaw`
      SELECT p.id FROM "Promotion" p
      WHERE p.id IN (SELECT d."promotionId" FROM "OrderDiscount" d WHERE d."orderId" = ${orderId})
      ORDER BY p.id FOR UPDATE`;
  }

  /** The coupon codes this order used, as the buyer typed them (ux.md "Your {code} coupon can be used again."). */
  async couponCodesForOrder(orderId: string, db: Db = prisma): Promise<string[]> {
    const rows = await db.orderDiscount.findMany({
      where: { orderId, codeSnapshot: { not: null } },
      select: { codeSnapshot: true },
      distinct: ["promotionId"],
      orderBy: { promotionId: "asc" },
    });
    return rows.flatMap((r) => (r.codeSnapshot ? [r.codeSnapshot] : []));
  }

  // ── Offer maintenance ─────────────────────────────────────────────────────
  // The only writer of `prisma.promotion` (ADR-0003). Callers pass a scope filter
  // rather than an id alone, so permission and query are the same clause: another
  // audience's offer id matches nothing rather than matching and updating.

  /** A promotion the given audience may act on, or null. */
  async findScoped(id: string, scope: Prisma.PromotionWhereInput, db: Db = prisma) {
    return await db.promotion.findFirst({ where: { id, ...scope }, select: { id: true, platformSpentPaise: true } });
  }

  /** The same scoped lookup, with everything an edit form needs to prefill. */
  async findScopedWithTargets(id: string, scope: Prisma.PromotionWhereInput, db: Db = prisma) {
    return await db.promotion.findFirst({
      relationLoadStrategy: "join",
      where: { id, ...scope },
      include: { targets: { select: { categoryId: true, productId: true } } },
    });
  }

  async listScoped(
    scope: Prisma.PromotionWhereInput,
    { page = 1, limit = 24 }: { page?: number; limit?: number } = {},
    db: Db = prisma
  ) {
    const [offers, total] = await Promise.all([
      db.promotion.findMany({
      relationLoadStrategy: "join",
      where: scope,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        targets: {
          include: {
            category: { select: { name: true } },
            product: { select: { name: true } },
          },
        },
        _count: { select: { orderDiscounts: true } },
        lossConfirmedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      }),
      db.promotion.count({ where: scope }),
    ]);
    return {
      offers,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async createOffer(
    data: Prisma.PromotionUncheckedCreateInput,
    targets: Array<{ categoryId?: string; productId?: string }>,
    db: Db = prisma
  ) {
    return await db.promotion.create({
      data: { ...data, targets: { create: targets } },
      include: { targets: { orderBy: { id: "asc" as const } } },
    });
  }

  /**
   * Replace an offer and its targets together.
   *
   * One transaction because a target set half-replaced is an offer covering the wrong
   * things — and with zero rows meaning "everything in scope", a failure between the
   * delete and the create would widen it store-wide.
   */
  async replaceOffer(
    id: string,
    data: Prisma.PromotionUncheckedUpdateInput,
    targets: Array<{ categoryId?: string; productId?: string }>
  ) {
    return await prisma.$transaction(async (tx) => {
      await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
      return await tx.promotion.update({
        where: { id },
        data: { ...data, targets: { create: targets } },
        include: { targets: { orderBy: { id: "asc" as const } } },
      });
    });
  }

  /** Stop an offer. Never a delete — an order's discount record may name it. */
  async deactivateScoped(id: string, scope: Prisma.PromotionWhereInput, db: Db = prisma) {
    const stopped = await db.promotion.updateMany({
      where: { id, ...scope },
      data: { isActive: false },
    });
    return stopped.count;
  }

  /** A markdown's current price and whether it is running — enough to decide if a
   * product save has anything to change. */
  async findMarkdownState(id: string, db: Db = prisma) {
    return await db.promotion.findUnique({
      where: { id },
      select: { fixedPricePaise: true, isActive: true },
    });
  }

  /** Create or update a product's markdown offer, keyed on a derived id. */
  async upsertMarkdown(
    id: string,
    create: Prisma.PromotionUncheckedCreateInput & {
      targets: { create: Array<{ id: string; productId: string }> };
    },
    update: Prisma.PromotionUncheckedUpdateInput,
    db: Db = prisma
  ) {
    await db.promotion.upsert({ where: { id }, create, update });
  }

  async deactivateById(id: string, db: Db = prisma) {
    await db.promotion.updateMany({ where: { id }, data: { isActive: false } });
  }

  /**
   * How many times this buyer has already redeemed this offer.
   *
   * Counted from the attribution rows on their own paid and pending orders, which is
   * the only record of a redemption that survives — the usage counter is global and
   * says nothing about who spent it.
   */
  async redemptionsByUser(promotionId: string, userId: string, db: Db = prisma): Promise<number> {
    return await db.orderDiscount.count({
      where: { promotionId, order: { userId, NOT: { status: "expired" } } },
    });
  }

  /** The coupon-backed offers an order is holding a claim on. */
  async codedDiscountsForOrder(orderId: string, db: Db = prisma): Promise<string[]> {
    const rows = await db.orderDiscount.findMany({
      where: { orderId, codeSnapshot: { not: null } },
      select: { promotionId: true },
      distinct: ["promotionId"],
    });
    return rows.map((row) => row.promotionId);
  }

  /**
   * What a campaign has cost the platform, across every order it touched.
   *
   * Read straight off the attribution rows rather than a reporting table: they
   * already carry both the offer and the platform's funded share (org-payouts D10).
   */
  async campaignCost(promotionId: string, db: Db = prisma) {
    const totals = await db.orderDiscount.aggregate({
      where: { promotionId },
      _sum: { platformFundedPaise: true, orgFundedPaise: true, buyerDiscountPaise: true },
      _count: { orderId: true },
    });
    return {
      platformFundedPaise: totals._sum.platformFundedPaise ?? 0,
      orgFundedPaise: totals._sum.orgFundedPaise ?? 0,
      buyerDiscountPaise: totals._sum.buyerDiscountPaise ?? 0,
      orderCount: totals._count.orderId,
    };
  }
}

export const promotionRepository = new PromotionRepository();
