import { productService } from "@server/catalog/product.service";
import { DomainError } from "@server/shared/domain-error";

import { FACT_DECLARATIONS, ORIGIN, type FactKey, type Origin } from "./listing-facts";

/**
 * Correcting a fact at a level above the product, and offering to correct what took its answer
 * from there ([inherited-facts](../../docs/specs/listing-vocabulary/inherited-facts/) R5, R6, D5).
 *
 * A hundred products saying "Made in India" because the brand said so are fixed in one action,
 * and the one somebody deliberately changed is left alone. That second half is the point: the
 * stored origin is what makes "has not since been edited by hand" answerable at all.
 *
 * **The preview and the update are one predicate, evaluated twice.** A count from one query and
 * rows from another is how a shop confirms one figure and a different set changes — the same failure
 * the org-profile work records as A4a. Both go through `matching` below.
 */

export interface CorrectionTarget {
  orgId: string;
  /** Which level is being corrected, and which row of it. */
  level: Extract<Origin, "family" | "brand" | "defaults">;
  /** The family or brand id. Absent for the org's own defaults, which have no id. */
  levelId?: string | null;
  fact: FactKey;
  /** The new answer, already a stored key rather than a label. */
  value: string | number | boolean;
}

export interface CorrectionPreview {
  /** Products that took this fact from this level and have not been edited since. */
  willChange: number;
  /** Products whose own answer differs — deliberate choices this leaves alone. */
  leftAlone: number;
}

/**
 * The products a correction applies to.
 *
 * Two conditions, both necessary: the product is under this level, **and** the stored answer
 * says this level supplied it. The second is what spares an answer somebody typed — editing a
 * value sets its origin to the product, even where the new value equals the inherited one
 * (D4), which is exactly so this query can tell them apart.
 */
function matching(target: CorrectionTarget) {
  const under =
    target.level === ORIGIN.FAMILY
      ? { familyId: target.levelId ?? undefined }
      : target.level === ORIGIN.BRAND
        ? { brandId: target.levelId ?? undefined }
        : {};

  return {
    orgId: target.orgId,
    ...under,
    facts: {
      path: [target.fact, "origin"],
      equals: target.level,
    },
  };
}

/** Products under the level whose answer is their own — shown so "left alone" is a number too. */
function ownAnswer(target: CorrectionTarget) {
  const under =
    target.level === ORIGIN.FAMILY
      ? { familyId: target.levelId ?? undefined }
      : target.level === ORIGIN.BRAND
        ? { brandId: target.levelId ?? undefined }
        : {};
  return {
    orgId: target.orgId,
    ...under,
    facts: { path: [target.fact, "origin"], equals: ORIGIN.PRODUCT },
  };
}

export const factCorrectionService = {
  /**
   * What a correction would do, before it does it (R6).
   *
   * A correction and a change of supplier look identical to the system and are completely
   * different to the shop, so it is asked rather than assumed.
   */
  async preview(target: CorrectionTarget): Promise<CorrectionPreview> {
    assertKnownFact(target.fact);
    const [willChange, leftAlone] = await Promise.all([
      productService.countProductsWhere(matching(target)),
      productService.countProductsWhere(ownAnswer(target)),
    ]);
    return { willChange, leftAlone };
  },

  /**
   * Apply it, and answer with how many actually changed.
   *
   * The same predicate the preview counted, so the two cannot disagree. A product that gained
   * its own answer between the preview and the confirmation simply falls out of the set — which
   * is the right outcome, not a race to defend against.
   */
  async apply(target: CorrectionTarget): Promise<{ changed: number }> {
    assertKnownFact(target.fact);

    // `updateMany` cannot merge into a JSON path, so the rows are read and written. The set is
    // the products of one org under one level, which is tens or hundreds — not a scan.
    const products = await productService.listProductFactsWhere(matching(target));

    if (products.length === 0) return { changed: 0 };

    await productService.replaceProductFacts(
      products.map((product) => ({
        id: product.id,
        facts: {
          ...(product.facts as Record<string, unknown>),
          // The origin stays the level's: the shop did not type this, and a later
          // correction at the same level must find it again.
          [target.fact]: { value: target.value, origin: target.level },
        },
      })),
    );

    return { changed: products.length };
  },
};

function assertKnownFact(fact: FactKey) {
  if (!FACT_DECLARATIONS[fact]) {
    throw new DomainError(`There is no fact called "${fact}"`, { field: "fact" });
  }
}
