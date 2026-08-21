/**
 * Which lines an offer covers (promotions D2/D3).
 *
 * Targeting only ever narrows: an offer with no target rows applies to everything in
 * its scope, which is why there is no `ALL` member to declare — and why a target row
 * must never be cascade-deleted, since losing the last one widens the offer to the
 * whole store (ADR-0020).
 */

import type { DiscountableLine, EnginePromotion } from "@server/promotions/promotion.types";

/** `categoryId -> parentId`. Null parent is a root. */
export type CategoryParents = ReadonlyMap<string, string | null>;

/**
 * A category and its ancestors, nearest first.
 *
 * Defensive against a cycle rather than trusting the write path to have refused one:
 * this runs on every listing render, and an infinite loop there is a worse failure
 * than a silently truncated ancestry.
 */
export function categoryAncestry(categoryId: string, parents: CategoryParents): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = categoryId;

  while (current !== null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = parents.get(current) ?? null;
  }

  return chain;
}

/** Does this offer's funding scope reach this line's organisation? */
export function scopeCoversLine(promotion: EnginePromotion, line: DiscountableLine): boolean {
  if (promotion.scope === "PLATFORM") return true;
  return promotion.orgId === line.orgId;
}

/**
 * Does this offer cover this line?
 *
 * A category target reaches the whole subtree — "20% off Electronics" that missed
 * Electronics → Audio → Headphones would look broken to everyone (spec R2).
 */
export function promotionCoversLine(
  promotion: EnginePromotion,
  line: DiscountableLine,
  parents: CategoryParents
): boolean {
  if (!scopeCoversLine(promotion, line)) return false;
  if (promotion.targets.length === 0) return true;

  const ancestry = categoryAncestry(line.categoryId, parents);

  return promotion.targets.some((target) => {
    if (target.productId !== null) return target.productId === line.productId;
    if (target.categoryId !== null) return ancestry.includes(target.categoryId);
    return false;
  });
}

/**
 * Is this offer running at this instant?
 *
 * The instant is an argument rather than `new Date()` so the same one prices a
 * preview and the transaction that follows it (ADR-0018 decision 2). `endsAt` is an
 * exclusive upper bound, which gives the boundary one unambiguous reading.
 */
export function isLive(promotion: EnginePromotion, now: Date): boolean {
  if (!promotion.isActive) return false;
  if (promotion.startsAt.getTime() > now.getTime()) return false;
  if (promotion.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Has a usage-limited offer been used up? The authoritative check is the conditional write. */
export function isExhausted(promotion: EnginePromotion): boolean {
  return promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit;
}

export interface OfferCoverage {
  coversEverything: boolean;
  productIds: string[];
  orgIds: string[];
  categoryIds: string[];
}

/**
 * Which products the live automatic offers reach — the "on offer" listing's question.
 *
 * Pure computation over an already-loaded PriceContext: the same promotions and
 * parents map every price read shares. It used to be a repository method that
 * re-queried both tables, which billed two extra operations per listing for data
 * the request had already paid for — and read the clock a second time, so the
 * filter and the price labels could disagree across an offer boundary.
 *
 * `coversEverything` is returned rather than materialising every product id,
 * because a store-wide platform offer covers the entire catalogue and enumerating
 * it to answer "show me eight" would be absurd.
 */
export function offerCoverage(
  promotions: readonly EnginePromotion[],
  parents: CategoryParents
): OfferCoverage {
  const automatic = promotions.filter((promotion) => promotion.trigger === "AUTOMATIC");

  const productIds = new Set<string>();
  const orgIds = new Set<string>();
  const categoryIds = new Set<string>();
  let coversEverything = false;

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
