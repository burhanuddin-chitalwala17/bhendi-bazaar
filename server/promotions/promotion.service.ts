/**
 * The promotions domain's public surface (promotions D1).
 *
 * Checkout calls this; it never reaches for the repository or the engine directly.
 * The service's whole job is to load what the pure engine needs and hand back its
 * answer — no arithmetic lives here, because arithmetic that lives beside I/O cannot
 * be tested without it.
 */

import { prisma } from "@server/shared/prisma";
import {
  promotionRepository,
  type PromotionDb,
} from "@server/promotions/promotion.repository";
import { normaliseCode, quoteDiscounts } from "@server/promotions/discount-engine";
import { isExhausted, isLive } from "@server/promotions/targeting";
import { DomainError, ConflictError } from "@server/shared/domain-error";
import type { DiscountQuote, DiscountableLine } from "@server/promotions/promotion.types";

type Db = PromotionDb;

export class PromotionService {
  /**
   * What every offer does to this basket, at this instant.
   *
   * The instant is an argument rather than read here, so a preview and the
   * transaction that follows can be priced at the same moment (ADR-0018).
   */
  async quote(
    lines: readonly DiscountableLine[],
    options: { code?: string | null; userId?: string | null; now?: Date; db?: Db } = {}
  ): Promise<DiscountQuote> {
    const now = options.now ?? new Date();
    const db = options.db ?? prisma;
    const typed = options.code ? normaliseCode(options.code) : null;

    const [live, categoryParents] = await Promise.all([
      promotionRepository.listLive(now, db),
      promotionRepository.categoryParents(db),
    ]);

    // The typed code is fetched separately and unfiltered by the window, so an
    // expired coupon can be reported as expired rather than as unrecognised.
    const promotions = [...live];
    if (typed !== null && !live.some((p) => p.code === typed)) {
      const coded = await promotionRepository.findByCode(typed, db);
      if (coded) promotions.push(coded);
    }

    // Counted only when there is both a code and someone to count against; a guest
    // is refused by the engine rather than silently exempted.
    const priorRedemptions =
      typed && options.userId
        ? await promotionRepository.redemptionsByUser(
            promotions.find((p) => p.code === typed)?.id ?? "",
            options.userId,
            db
          )
        : 0;

    return quoteDiscounts({
      lines,
      promotions,
      categoryParents,
      code: typed,
      userId: options.userId ?? null,
      priorRedemptions,
      now,
    });
  }

  /**
   * Re-resolve at order time and claim any coupon use, inside the caller's transaction.
   *
   * Two things happen here that cannot happen in a preview. The offer window is
   * re-checked against the clock and refused with its own message, rather than
   * surfacing later as the generic price-change guard (promotions D14). And a
   * usage-limited coupon is claimed with a conditional write, so the limit holds when
   * several buyers redeem at the same moment (D11).
   */
  async applyToOrder(
    lines: readonly DiscountableLine[],
    options: { code?: string | null; userId?: string | null; now: Date; tx: Db }
  ): Promise<DiscountQuote & { claimedPromotionIds: string[] }> {
    const { code, userId, now, tx } = options;
    const quote = await this.quote(lines, { code, userId, now, db: tx });

    // A code the buyer saw accepted must not silently become a no-op between review
    // and payment: say which of the two happened.
    if (code && quote.rejection) {
      if (quote.rejection.reason === "NOT_LIVE") {
        throw new ConflictError("That offer expired while you were checking out.");
      }
      if (quote.rejection.reason === "EXHAUSTED") {
        throw new ConflictError("That offer was fully claimed while you were checking out.");
      }
      throw new DomainError(quote.rejection.message, { field: "couponCode" });
    }

    const claimedPromotionIds: string[] = [];
    if (code) {
      const typed = normaliseCode(code);
      const applied = quote.attributions.find((a) => a.codeSnapshot === typed);
      if (applied) {
        const claimed = await promotionRepository.claimUse(applied.promotionId, tx);
        if (!claimed) {
          throw new ConflictError("That offer was fully claimed while you were checking out.");
        }
        claimedPromotionIds.push(applied.promotionId);
      }
    }

    return { ...quote, claimedPromotionIds };
  }

  /**
   * Put one product on sale, or take it off (promotions D9).
   *
   * A markdown is an organisation's own offer at a fixed selling price, so the
   * product form writes one of these rather than a column. Keeping the organisation's
   * inline "sale price" field is the point — what moved is where it is stored, not
   * how it is edited.
   *
   * The id is derived from the product, matching the backfill migration, so an offer
   * is traceable to the row it came from and setting a sale twice does not accumulate
   * offers. Clearing it deactivates rather than deletes: the offer may already be
   * attached to an order's discount record, which must outlive it (ADR-0020).
   */
  async setProductMarkdown(input: {
    productId: string;
    /** Names the offer in the list, matching what the backfill wrote. */
    productName: string;
    orgId: string;
    fixedPricePaise: number | null;
  }): Promise<void> {
    const id = `mkdn_${input.productId}`;
    const existing = await promotionRepository.findMarkdownState(id);

    if (input.fixedPricePaise === null) {
      if (existing?.isActive) await promotionRepository.deactivateById(id);
      return;
    }

    // A save that does not change the price changes nothing at all — including a
    // markdown someone stopped. Two surfaces write this offer, and the form has to be
    // able to save a description edit without reaching for one it was not asked to
    // touch. Changing the price *does* restart it: retyping a price means selling
    // at it.
    if (existing && existing.fixedPricePaise === input.fixedPricePaise) {
      return;
    }

    await promotionRepository.upsertMarkdown(
      id,
      {
        id,
        label: `Markdown — ${input.productName}`,
        scope: "ORG",
        orgId: input.orgId,
        trigger: "AUTOMATIC",
        valueType: "FIXED_PRICE",
        fixedPricePaise: input.fixedPricePaise,
        startsAt: new Date(),
        // Only ever set at creation. A markdown created here has no deadline anyone
        // chose, and the offers screen is where one gets set.
        endsAt: new Date("2099-12-31T00:00:00Z"),
        targets: { create: [{ id: `mkdntgt_${input.productId}`, productId: input.productId }] },
      },
      {
        // Price and running state only. The window belongs to whoever scheduled it —
        // a description edit must not move an end date someone deliberately set.
        fixedPricePaise: input.fixedPricePaise,
        isActive: true,
      }
    );
  }

  /** Give back the coupon uses an expiring order was holding (D11). */
  async releaseForOrder(orderId: string, db: Db = prisma): Promise<void> {
    const promotionIds = await promotionRepository.codedDiscountsForOrder(orderId, db);
    for (const promotionId of promotionIds) {
      await promotionRepository.releaseUse(promotionId, db);
    }
  }

  /** Is this offer usable right now? Shared by the admin surfaces. */
  isUsableNow(promotion: Parameters<typeof isLive>[0], now = new Date()): boolean {
    return isLive(promotion, now) && !isExhausted(promotion);
  }
}

export const promotionService = new PromotionService();
