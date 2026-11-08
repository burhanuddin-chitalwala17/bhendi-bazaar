import { DomainError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";

import { askCompleteness } from "./completeness.queue";
import { FACT_DECLARATIONS, ANSWER, ORIGIN, type FactKey } from "./listing-facts";
import { listingValueRepository } from "./listing-value.repository";
import type { FixAnswerResultDTO } from "./readiness-fix.types";

/**
 * Answering one missing fact across many products (readiness-fix): each pick saved at once, only
 * into an empty answer, and undoable while it is still the one given. Never a gate (ADR-0053).
 */

/** The answers a fact can take for this shop, from its value list; only a choice fact has a picker (Q8). */
export async function optionsFor(orgId: string, fact: string): Promise<Array<{ key: string; label: string }>> {
  const declaration = FACT_DECLARATIONS[fact as FactKey];
  if (!declaration || declaration.answer !== ANSWER.CHOICE || !declaration.list) return [];
  const lists = await listingValueRepository.byLists([declaration.list], orgId);
  return (lists[declaration.list] ?? []).map((o) => ({ key: o.key, label: o.label }));
}

export const readinessFixService = {
  optionsFor,

  /**
   * Set one answer on these products (R3, R4, Q5): refused unless it is one of the fact's offered
   * answers; written only where the product has none, so an answer typed meanwhile is never replaced.
   */
  async answer(orgId: string, fact: string, value: string, productIds: readonly string[]): Promise<FixAnswerResultDTO> {
    const options = await optionsFor(orgId, fact);
    if (!options.some((o) => o.key === value)) throw new DomainError("Pick one of the answers offered.", { field: "value" });
    const set: string[] = [];
    const skipped: string[] = [];
    for (const id of productIds) {
      const result = await productService.setMarketplaceAnswer(orgId, id, "facts", fact, { value, origin: ORIGIN.PRODUCT }, true);
      if (result && "saved" in result && result.saved) set.push(id);
      else skipped.push(id);
    }
    // The Home line this page answers moves only when completeness is recomputed (dynamic-form Q10).
    if (set.length > 0) await askCompleteness([orgId], set);
    return { set, skipped };
  },

  /** Undo a pick while it is still the answer given (R3, parent Q43). */
  async undo(orgId: string, fact: string, value: string, productId: string): Promise<boolean> {
    const undone = await productService.clearFactIf(orgId, productId, fact, value);
    if (undone) await askCompleteness([orgId], [productId]);
    return undone;
  },
};
