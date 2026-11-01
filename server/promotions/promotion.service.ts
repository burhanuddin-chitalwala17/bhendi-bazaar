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
  type PromotionTx,
} from "@server/promotions/promotion.repository";
import { normaliseCode, quoteDiscounts } from "@server/promotions/discount-engine";
import { isExhausted, isLive, overBudget } from "@server/promotions/targeting";
import { saleFloorBreach } from "@server/promotions/ceiling";
import { DomainError, ConflictError } from "@server/shared/domain-error";
import {
  commercialTermsService,
  type CommercialTermsDb,
} from "@server/catalog/commercial-terms.service";
import type {
  DiscountQuote,
  DiscountableLine,
  EnginePromotion,
  PromotionAttribution,
} from "@server/promotions/promotion.types";

type Db = PromotionDb & CommercialTermsDb;

export class PromotionService {
  /**
   * What every offer does to this basket, at this instant.
   *
   * The instant is an argument rather than read here, so a preview and the
   * transaction that follows can be priced at the same moment (ADR-0018).
   */
  /**
   * Every category's parent, as a map — the ancestry a commission rate is resolved through
   * ([ADR-0019](../../docs/adr/0019-discount-is-one-winning-offer.md)). Exposed because
   * `payouts` walks the same tree to find which rule applies to a sold line, and reaching
   * `promotion.repository` from another domain is what ADR-0033 forbids.
   */
  async categoryParents(db?: Parameters<typeof promotionRepository.categoryParents>[0]) {
    return await promotionRepository.categoryParents(db);
  }

  async quote(
    lines: readonly DiscountableLine[],
    options: { code?: string | null; userId?: string | null; now?: Date; db?: Db } = {}
  ): Promise<DiscountQuote> {
    return (await this.quoteWithOffers(lines, options)).quote;
  }

  /** The quote and the offers it was decided from, so the order can spend what it used. */
  private async quoteWithOffers(
    lines: readonly DiscountableLine[],
    options: { code?: string | null; userId?: string | null; now?: Date; db?: Db }
  ): Promise<{ quote: DiscountQuote; promotions: EnginePromotion[] }> {
    const now = options.now ?? new Date();
    const db = options.db ?? prisma;
    const typed = options.code ? normaliseCode(options.code) : null;

    const [live, categoryParents, orgCeilings] = await Promise.all([
      promotionRepository.listLive(now, db),
      promotionRepository.categoryParents(db),
      commercialTermsService.allCeilings(db),
    ]);

    // The typed code is fetched separately and unfiltered by the window, so an
    // expired coupon can be reported as expired rather than as unrecognised.
    let promotions = [...live];
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

    // Which offers fit their budget is decided on the shown price, as the preview (which has no
    // funding basis) decides it; otherwise the charge could keep an offer the review left out
    // (ADR-0018). The basis then lowers what a kept offer spends (offers-hardening D7).
    const atPrice = lines.map((line) => ({ ...line, fundingBasisUnitPaise: undefined }));
    const decide = (quoted: readonly DiscountableLine[] = atPrice) =>
      quoteDiscounts({
        lines: quoted,
        promotions,
        categoryParents,
        orgCeilings,
        code: typed,
        userId: options.userId ?? null,
        priorRedemptions,
        now,
      });
    let quote = decide();
    // An offer that cannot afford this basket is treated as spent and the basket priced again, as
    // often as that changes the winner — at most once per offer (offers-hardening Q4).
    for (let round = 0; round < promotions.length; round++) {
      const short = overBudget(quote.attributions, promotions);
      if (short.size === 0) break;
      promotions = promotions.map((p) =>
        short.has(p.id) ? { ...p, platformSpentPaise: p.platformBudgetPaise ?? p.platformSpentPaise } : p
      );
      quote = decide();
    }
    return { quote: decide(lines), promotions };
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
    options: { code?: string | null; userId?: string | null; now: Date; tx: PromotionTx }
  ): Promise<
    Omit<DiscountQuote, "attributions"> & {
      claimedPromotionIds: string[];
      /** Each attribution with what it charged its offer's budget, for its `OrderDiscount` row. */
      attributions: Array<PromotionAttribution & { budgetChargedPaise: number }>;
    }
  > {
    const { code, userId, now, tx } = options;
    // Locked before the per-buyer count, or two checkouts by one buyer both count zero (D3).
    if (code) await promotionRepository.lockByCode(normaliseCode(code), tx);
    const { quote, promotions } = await this.quoteWithOffers(lines, { code, userId, now, db: tx });

    // A coupon that stopped working between review and payment is refused with its reason — except
    // one a better offer overtook, which is set aside unclaimed at the lower price (offers-hardening D9).
    if (code && quote.rejection && quote.rejection.reason !== "ALREADY_BETTER_OFF") {
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

    const attributions = await this.spendBudgets(quote, promotions, tx);

    return { ...quote, attributions, claimedPromotionIds };
  }

  /**
   * Charge each budgeted platform offer what this order costs it (offers-hardening D5, Q4).
   * Sorted by id so two checkouts take the rows in one order; a miss ends the checkout rather
   * than charge a total the buyer did not review (ADR-0018).
   */
  private async spendBudgets(quote: DiscountQuote, promotions: EnginePromotion[], tx: PromotionTx) {
    const budgeted = new Set(
      promotions.filter((p) => p.scope === "PLATFORM" && p.platformBudgetPaise !== null).map((p) => p.id)
    );
    const attributions = quote.attributions.map((a) => ({
      ...a,
      budgetChargedPaise: budgeted.has(a.promotionId) ? a.platformFundedPaise : 0,
    }));
    const cost = new Map<string, number>();
    for (const a of attributions) {
      if (a.budgetChargedPaise > 0) {
        cost.set(a.promotionId, (cost.get(a.promotionId) ?? 0) + a.budgetChargedPaise);
      }
    }
    for (const [promotionId, amount] of [...cost].sort(([a], [b]) => a.localeCompare(b))) {
      if (!(await promotionRepository.spendBudget(promotionId, amount, tx))) {
        throw new ConflictError("That offer has just ended. Please review your total.");
      }
    }
    return attributions;
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

  /**
   * Refuse a sale price deeper than the shop's discount ceiling, before anything is saved
   * (offers-hardening R3, Q7). The engine clamps one a later price edit breaches.
   */
  async assertSalePriceWithinCeiling(
    orgId: string, pricePaise: number, salePricePaise: number, productId?: string,
  ): Promise<void> {
    const terms = await commercialTermsService.find(orgId);
    if (!terms) return;
    const breach = await this.saleBreach({ productId, pricePaise, salePricePaise, ceilingBps: terms.maxDiscountBps });
    if (breach) throw new DomainError(breach, { field: "salePrice" });
  }

  /**
   * The refusal as words, for the form and for a caller that reports rows (bulk sheet). A sale
   * price equal to the product's running markdown is not re-judged: `setProductMarkdown` writes
   * nothing for it and the engine clamps it, so an old markdown cannot block a save.
   */
  async saleBreach(input: {
    productId?: string; pricePaise: number; salePricePaise: number; ceilingBps: number;
  }): Promise<string | null> {
    const breach = saleFloorBreach(input.pricePaise, input.salePricePaise, input.ceilingBps);
    if (!breach || !input.productId) return breach;
    return (await this.productMarkdownPaise(input.productId)) === input.salePricePaise ? null : breach;
  }

  /**
   * The sale price this product's own markdown sets, or null when it has none running. What the
   * edit form shows — never the resolved price, which a platform campaign may have set and which
   * saving would turn into a shop-funded markdown.
   */
  async productMarkdownPaise(productId: string): Promise<number | null> {
    const state = await promotionRepository.findMarkdownState(`mkdn_${productId}`);
    return state?.isActive ? state.fixedPricePaise : null;
  }

  /** Give back the coupon uses and budget an expiring order was holding (D11, offers-hardening Q3). */
  async releaseForOrder(orderId: string, tx: PromotionTx): Promise<void> {
    await this.releaseCouponUses(orderId, tx);
    await promotionRepository.releaseBudgetForOrder(orderId, tx);
  }

  /**
   * Give back the coupon uses an order claimed. Expiry calls it, and a cancel only once every parcel
   * of the order is cancelled (order-fulfilment D13, own-store Q5): a buyer who kept part used it.
   */
  async releaseCouponUses(orderId: string, tx: PromotionTx): Promise<void> {
    for (const promotionId of await promotionRepository.codedDiscountsForOrder(orderId, tx)) {
      await promotionRepository.releaseUse(promotionId, tx);
    }
  }

  /** One parcel's share of each offer's budget, back once per parcel and offer (D13, Q10). */
  async releaseParcelBudget(
    parcel: { orderId: string; shipmentId: string },
    shares: Map<string, number>,
    tx: PromotionTx,
  ): Promise<void> {
    for (const [promotionId, amountPaise] of shares) {
      await promotionRepository.releaseBudget({ promotionId, orderId: parcel.orderId, shipmentId: parcel.shipmentId, amountPaise }, tx);
    }
  }

  /** What each offer charged this order's budget, per shop (Q33's input), on the caller's transaction. */
  async budgetChargesForOrder(orderId: string, tx: PromotionTx) {
    return await promotionRepository.budgetChargesForOrder(orderId, tx);
  }

  /** Hold this order's offers before a cancel moves stock, keeping Promotion ahead of stock (D2). */
  async lockForOrder(orderId: string, tx: PromotionTx): Promise<void> {
    await promotionRepository.lockForOrder(orderId, tx);
  }

  /** The coupon codes an order used, for the buyer's "can be used again" line. */
  async couponCodesForOrder(orderId: string): Promise<string[]> {
    return await promotionRepository.couponCodesForOrder(orderId);
  }

  /** Is this offer usable right now? Shared by the admin surfaces. */
  isUsableNow(promotion: Parameters<typeof isLive>[0], now = new Date()): boolean {
    return isLive(promotion, now) && !isExhausted(promotion);
  }
}

export const promotionService = new PromotionService();
