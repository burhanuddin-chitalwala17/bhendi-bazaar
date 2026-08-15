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
import { orgRepository } from "@server/catalog/org.repository";
import { productsRepository } from "@server/catalog/product.repository";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import type { PromotionFormInput } from "@/lib/validation/schemas/promotion.schema";

/** Who is creating the offer, and therefore who funds it. */
export type PromotionOwner = { scope: "PLATFORM" } | { scope: "ORG"; orgId: string };

export class AdminPromotionService {
  /**
   * Turn a form into an offer.
   *
   * The rupees→paise and percent→basis-points seams live here, for the same reason
   * the product form's do: humans type rupees and percentages, and everything past
   * this line is integer (ADR-0004). Conversion is not a Zod transform because the
   * same schema validates on both sides and would run twice.
   */
  private async toRow(input: PromotionFormInput, owner: PromotionOwner) {
    if (owner.scope === "ORG") {
      await this.assertWithinOrgCeiling(input, owner.orgId);
      await this.assertCodePrefixed(input, owner.orgId);
      await this.assertProductsBelongToOrg(input, owner.orgId);
    }

    return {
      label: input.label,
      scope: owner.scope,
      orgId: owner.scope === "ORG" ? owner.orgId : null,
      trigger: input.trigger,
      code: input.trigger === "CODE" ? (input.code ?? null) : null,
      valueType: input.valueType,
      percentBps: input.percent !== undefined ? Math.round(input.percent * 100) : null,
      amountOffPaise: input.amountOff !== undefined ? rupeesToPaise(input.amountOff) : null,
      fixedPricePaise: input.fixedPrice !== undefined ? rupeesToPaise(input.fixedPrice) : null,
      maxDiscountPaise: input.maxDiscount !== undefined ? rupeesToPaise(input.maxDiscount) : null,
      minSubtotalPaise: input.minSubtotal !== undefined ? rupeesToPaise(input.minSubtotal) : 0,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
    };
  }

  /**
   * An organisation cannot discount deeper than the platform allows it (D13a).
   *
   * A guard against mis-keying a margin away, which is a real hazard with self-serve
   * signup — not a platform protection, since an organisation's own discount shrinks
   * the platform's commission proportionally and can never drive it negative.
   */
  private async assertWithinOrgCeiling(input: PromotionFormInput, orgId: string) {
    const org = await orgRepository.findCommercialTerms(orgId);
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
  }

  /**
   * An organisation's codes carry its own code as a prefix (D13).
   *
   * This makes collisions impossible by construction rather than by an error message,
   * and makes partial coverage self-explaining — a code that names its organisation
   * answers "why did this only apply to some items" without a support message.
   */
  private async assertCodePrefixed(input: PromotionFormInput, orgId: string) {
    if (input.trigger !== "CODE" || !input.code) return;
    const org = await orgRepository.findCommercialTerms(orgId);
    if (!org) throw new NotFoundError("Organisation not found");
    const prefix = `${org.code}-`;
    if (!input.code.startsWith(prefix)) {
      throw new DomainError(`Your codes start with ${prefix}, so buyers know whose offer it is`, {
        field: "code",
      });
    }
  }

  /** An organisation's offer may only name its own goods (spec R1, R20). */
  private async assertProductsBelongToOrg(input: PromotionFormInput, orgId: string) {
    if (input.productIds.length === 0) return;
    const foreign = await productsRepository.countOutsideOrg(input.productIds, orgId);
    if (foreign > 0) {
      throw new DomainError("An offer can only cover your own products", { field: "productIds" });
    }
  }

  private targetRows(input: PromotionFormInput) {
    return [
      ...input.categoryIds.map((categoryId) => ({ categoryId })),
      ...input.productIds.map((productId) => ({ productId })),
    ];
  }

  async create(input: PromotionFormInput, owner: PromotionOwner) {
    const data = await this.toRow(input, owner);
    try {
      return await promotionRepository.createOffer(data, this.targetRows(input));
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
  async update(id: string, input: PromotionFormInput, owner: PromotionOwner) {
    const data = await this.toRow(input, owner);
    const scopeFilter = owner.scope === "ORG" ? { orgId: owner.orgId } : { scope: "PLATFORM" as const };

    const existing = await promotionRepository.findScoped(id, scopeFilter);
    if (!existing) throw new NotFoundError("Offer not found");

    return await promotionRepository.replaceOffer(id, data, this.targetRows(input));
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
