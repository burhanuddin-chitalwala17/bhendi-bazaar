/**
 * Creating and maintaining offers, for both audiences.
 *
 * Not a separate admin domain: an offer list is a query on `promotions`, kept as
 * `admin.*` files inside it (root CLAUDE.md). The two audiences differ only in what
 * scope they may set — which is why `orgId` is a parameter here and never a field on
 * the input, so a handler physically cannot pass one that came from a body.
 */

import { rupeesToPaise } from "@server/shared/money";
import { promotionRepository } from "@server/promotions/promotion.repository";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import type {
  PlatformPromotionFormInput,
  PromotionFormInput,
} from "@/lib/validation/schemas/promotion.schema";
import { productService } from "@server/catalog/product.service";
import { commercialTermsService } from "@server/catalog/commercial-terms.service";
import { offerCeilingBreach } from "@server/promotions/ceiling";
import {
  CONFIRM_LOSS_ERROR,
  CONFIRM_LOSS_PHRASE,
  LOSS_BUDGET_REQUIRED,
  couldCostMoreThanCommission,
} from "@server/promotions/loss";
import { formatCurrency } from "@server/shared/money";
import { recordAdminAction } from "@server/shared/audit/audit.service";

/** Who is creating the offer, and therefore who funds it. */
export type PromotionOwner = { scope: "PLATFORM" } | { scope: "ORG"; orgId: string };

/**
 * Who is saving it. A platform save names the admin from the session, never the body, so a
 * confirmed loss records who accepted it (offers-hardening D6, Q11).
 */
export type PromotionWriter = { scope: "PLATFORM"; userId: string } | { scope: "ORG"; orgId: string };

/** Either audience's form; a shop's carries no budget or confirmation (the schema strips them). */
type OfferInput = PromotionFormInput | PlatformPromotionFormInput;

export class AdminPromotionService {
  /**
   * Turn a form into an offer.
   *
   * The rupees→paise and percent→basis-points seams live here, for the same reason
   * the product form's do: humans type rupees and percentages, and everything past
   * this line is integer (ADR-0004). Conversion is not a Zod transform because the
   * same schema validates on both sides and would run twice.
   */
  private async toRow(input: OfferInput, owner: PromotionWriter) {
    if (owner.scope === "ORG") {
      await this.assertCodePrefixed(input, owner.orgId);
      // Ownership first: the ceiling message quotes a product's price.
      await this.assertProductsBelongToOrg(input, owner.orgId);
      await this.assertWithinOrgCeiling(input, owner.orgId);
    }

    const value = {
      valueType: input.valueType,
      percentBps: input.percent !== undefined ? Math.round(input.percent * 100) : null,
      amountOffPaise: input.amountOff !== undefined ? rupeesToPaise(input.amountOff) : null,
      fixedPricePaise: input.fixedPrice !== undefined ? rupeesToPaise(input.fixedPrice) : null,
      minSubtotalPaise: input.minSubtotal !== undefined ? rupeesToPaise(input.minSubtotal) : 0,
    };

    return {
      ...value,
      ...(owner.scope === "PLATFORM"
        ? await this.budgetAndLoss(input as PlatformPromotionFormInput, value, owner.userId)
        : { platformBudgetPaise: null }),
      label: input.label,
      scope: owner.scope,
      orgId: owner.scope === "ORG" ? owner.orgId : null,
      trigger: input.trigger,
      code: input.trigger === "CODE" ? (input.code ?? null) : null,
      maxDiscountPaise: input.maxDiscount !== undefined ? rupeesToPaise(input.maxDiscount) : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
    };
  }

  /**
   * A platform offer that can cost more than commission exists only once an admin has typed the
   * phrase and set a budget (offers-hardening D6, own-store Q20). Run on every save, so an edit
   * that deepens an offer asks again; the spend is never input and an edit never resets it.
   */
  private async budgetAndLoss(
    input: PlatformPromotionFormInput,
    value: Parameters<typeof couldCostMoreThanCommission>[0],
    userId: string
  ) {
    const platformBudgetPaise = input.budget !== undefined ? rupeesToPaise(input.budget) : null;
    // No loss possible: the confirmation fields are left out, so an edit keeps an earlier one (Q14).
    if (!couldCostMoreThanCommission(value, await commercialTermsService.lowestCommissionBps())) {
      return { platformBudgetPaise };
    }
    if (input.confirmLoss !== CONFIRM_LOSS_PHRASE) {
      throw new DomainError(CONFIRM_LOSS_ERROR, { field: "confirmLoss" });
    }
    if (platformBudgetPaise === null) throw new DomainError(LOSS_BUDGET_REQUIRED, { field: "budget" });
    return { platformBudgetPaise, lossConfirmedAt: new Date(), lossConfirmedByUserId: userId };
  }

  /**
   * An organisation cannot discount deeper than the platform allows it (D13a).
   *
   * A guard against mis-keying a margin away, which is a real hazard with self-serve
   * signup — not a platform protection, since an organisation's own discount shrinks
   * the platform's commission proportionally and can never drive it negative. A flat or
   * fixed-price offer is checked only on the products it names; on a category or everything
   * the price is not knowable here, and the engine clamps instead (offers-hardening Q7).
   */
  private async assertWithinOrgCeiling(input: OfferInput, orgId: string) {
    const org = await commercialTermsService.find(orgId);
    if (!org) throw new NotFoundError("Organisation not found");

    const bps =
      input.valueType === "PERCENT" && input.percent !== undefined
        ? Math.round(input.percent * 100)
        : null;
    if (bps !== null && bps > org.maxDiscountBps) {
      throw new DomainError(
        `Your organisation's offers are capped at ${org.maxDiscountBps / 100}%`,
        { field: "percent" }
      );
    }

    const flat = input.valueType === "AMOUNT_OFF" && input.amountOff !== undefined;
    const fixed = input.valueType === "FIXED_PRICE" && input.fixedPrice !== undefined;
    if ((!flat && !fixed) || input.productIds.length === 0) return;

    for (const product of await productService.listForPricing(input.productIds)) {
      const amountOff = flat
        ? rupeesToPaise(input.amountOff as number)
        : product.price - rupeesToPaise(input.fixedPrice as number);
      const breach = offerCeilingBreach(product.price, amountOff, org.maxDiscountBps);
      if (breach) throw new DomainError(breach, { field: flat ? "amountOff" : "fixedPrice" });
    }
  }

  /**
   * An organisation's codes carry its own code as a prefix (D13).
   *
   * This makes collisions impossible by construction rather than by an error message,
   * and makes partial coverage self-explaining — a code that names its organisation
   * answers "why did this only apply to some items" without a support message.
   */
  private async assertCodePrefixed(input: OfferInput, orgId: string) {
    if (input.trigger !== "CODE" || !input.code) return;
    const org = await commercialTermsService.find(orgId);
    if (!org) throw new NotFoundError("Organisation not found");
    const prefix = `${org.code}-`;
    if (!input.code.startsWith(prefix)) {
      throw new DomainError(`Your codes start with ${prefix}, so buyers know whose offer it is`, {
        field: "code",
      });
    }
  }

  /** An organisation's offer may only name its own goods (spec R1, R20). */
  private async assertProductsBelongToOrg(input: OfferInput, orgId: string) {
    if (input.productIds.length === 0) return;
    const foreign = await productService.countOutsideOrg(input.productIds, orgId);
    if (foreign > 0) {
      throw new DomainError("An offer can only cover your own products", { field: "productIds" });
    }
  }

  private targetRows(input: OfferInput) {
    return [
      ...input.categoryIds.map((categoryId) => ({ categoryId })),
      ...input.productIds.map((productId) => ({ productId })),
    ];
  }

  async create(input: OfferInput, owner: PromotionWriter) {
    const data = await this.toRow(input, owner);
    try {
      const created = await promotionRepository.createOffer(data, this.targetRows(input));
      await this.auditLossConfirmation(created.id, data, owner);
      return created;
    } catch (error) {
      // A code is one string typed by a buyer, so it resolves to exactly one offer.
      if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
        throw new ConflictError("That code is already in use", { field: "code" });
      }
      throw error;
    }
  }

  /**
   * Edit an offer.
   *
   * Scoped by owner as well as id: passing another organisation's offer id updates
   * nothing rather than updating it, because the filter and the permission are the
   * same clause.
   */
  async update(id: string, input: OfferInput, owner: PromotionWriter) {
    const data = await this.toRow(input, owner);
    const scopeFilter = owner.scope === "ORG" ? { orgId: owner.orgId } : { scope: "PLATFORM" as const };

    const existing = await promotionRepository.findScoped(id, scopeFilter);
    if (!existing) throw new NotFoundError("Offer not found");
    // The database refuses a budget below the spend; say so on the field instead.
    if (data.platformBudgetPaise !== null && data.platformBudgetPaise < existing.platformSpentPaise) {
      throw this.budgetBelowSpent(existing.platformSpentPaise);
    }

    try {
      const updated = await promotionRepository.replaceOffer(id, data, this.targetRows(input));
      await this.auditLossConfirmation(id, data, owner);
      return updated;
    } catch (error) {
      // An order spent between the check above and this write; the database refused it.
      if (String((error as { message?: unknown })?.message).includes("Promotion_spent_within_budget")) {
        const now = await promotionRepository.findScoped(id, scopeFilter);
        throw this.budgetBelowSpent(now?.platformSpentPaise ?? existing.platformSpentPaise);
      }
      throw error;
    }
  }

  private budgetBelowSpent(spentPaise: number) {
    return new DomainError(
      `This offer has already spent ${formatCurrency(spentPaise)}. Set a budget of at least that.`,
      { field: "budget" }
    );
  }

  /** Every accepted loss is on the audit trail, after the write commits (ADR-0021, Q11). */
  private async auditLossConfirmation(
    promotionId: string,
    data: { lossConfirmedAt?: Date; platformBudgetPaise: number | null },
    owner: PromotionWriter
  ) {
    if (owner.scope !== "PLATFORM" || !data.lossConfirmedAt) return;
    await recordAdminAction({
      adminId: owner.userId,
      action: "PROMOTION_LOSS_CONFIRMED",
      resource: "Promotion",
      resourceId: promotionId,
      metadata: { platformBudgetPaise: data.platformBudgetPaise },
    });
  }

  /**
   * Stop an offer.
   *
   * Deactivation, never deletion: an offer may already be named by an order's
   * discount record, which has to outlive it (ADR-0020). "Stopped" is also what an
   * operator actually means — the campaign happened.
   */
  async deactivate(id: string, owner: PromotionOwner) {
    const scopeFilter = owner.scope === "ORG" ? { orgId: owner.orgId } : { scope: "PLATFORM" as const };
    const stopped = await promotionRepository.deactivateScoped(id, scopeFilter);
    if (stopped === 0) throw new NotFoundError("Offer not found");
  }

  /** One offer this audience may edit, with its targets — or null. */
  async findForEdit(id: string, owner: PromotionOwner) {
    return await promotionRepository.findScopedWithTargets(
      id,
      owner.scope === "ORG" ? { orgId: owner.orgId } : { scope: "PLATFORM" }
    );
  }

  /** Offers this audience may see, newest first. */
  async list(owner: PromotionOwner, page = 1) {
    return await promotionRepository.listScoped(
      owner.scope === "ORG" ? { orgId: owner.orgId } : { scope: "PLATFORM" },
      { page }
    );
  }
}

export const adminPromotionService = new AdminPromotionService();
