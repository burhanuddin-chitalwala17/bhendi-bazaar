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

/**
 * Anything that can run these queries — the client, or a transaction handle. Named
 * so callers inside `$transaction` pass `tx` and get the same guarantees.
 */
export type PromotionDb = Pick<typeof prisma, "promotion" | "category" | "orderDiscount">;
type Db = PromotionDb;

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
    return await db.promotion.findMany({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      select: PROMOTION_SELECT,
    });
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
   * Which products currently carry an offer — the "on offer" listing's question.
   *
   * Used to be `salePrice IS NOT NULL`, a column test. Coverage is a computed thing
   * now: an offer may name products, name a category and reach its whole subtree, or
   * name nothing and cover everything in its scope.
   *
   * `coversEverything` is returned rather than materialising every product id,
   * because a store-wide platform offer covers the entire catalogue and enumerating
   * it to answer "show me eight" would be absurd.
   */
  async productsOnOffer(
    now: Date,
    db: Db = prisma
  ): Promise<{ coversEverything: boolean; productIds: string[]; orgIds: string[]; categoryIds: string[] }> {
    const live = await this.listLive(now, db);
    const automatic = live.filter((promotion) => promotion.trigger === "AUTOMATIC");

    const productIds = new Set<string>();
    const orgIds = new Set<string>();
    const categoryIds = new Set<string>();
    let coversEverything = false;

    const parents = await this.categoryParents(db);
    const childrenOf = new Map<string, string[]>();
    for (const [id, parentId] of parents) {
      if (parentId === null) continue;
      childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), id]);
    }
    // A Set, not an array with `includes` — the walk runs per targeted category on a
    // path that renders every listing, and a linear membership test inside a loop is
    // quadratic in the size of the tree.
    const subtree = (root: string): string[] => {
      const out = new Set<string>();
      const stack = [root];
      while (stack.length > 0) {
        const id = stack.pop() as string;
        if (out.has(id)) continue;
        out.add(id);
        stack.push(...(childrenOf.get(id) ?? []));
      }
      return [...out];
    };

    for (const promotion of automatic) {
      if (promotion.targets.length === 0) {
        if (promotion.scope === "PLATFORM") coversEverything = true;
        else if (promotion.orgId) orgIds.add(promotion.orgId);
        continue;
      }
      for (const target of promotion.targets) {
        if (target.productId) productIds.add(target.productId);
        else if (target.categoryId) subtree(target.categoryId).forEach((id) => categoryIds.add(id));
      }
    }

    return {
      coversEverything,
      productIds: [...productIds],
      orgIds: [...orgIds],
      categoryIds: [...categoryIds],
    };
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

  // ── Offer maintenance ─────────────────────────────────────────────────────
  // The only writer of `prisma.promotion` (ADR-0003). Callers pass a scope filter
  // rather than an id alone, so permission and query are the same clause: another
  // audience's offer id matches nothing rather than matching and updating.

  /** A promotion the given audience may act on, or null. */
  async findScoped(id: string, scope: Prisma.PromotionWhereInput, db: Db = prisma) {
    return await db.promotion.findFirst({ where: { id, ...scope }, select: { id: true } });
  }

  /** The same scoped lookup, with everything an edit form needs to prefill. */
  async findScopedWithTargets(id: string, scope: Prisma.PromotionWhereInput, db: Db = prisma) {
    return await db.promotion.findFirst({
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
      include: { targets: true },
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
        include: { targets: true },
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
