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
