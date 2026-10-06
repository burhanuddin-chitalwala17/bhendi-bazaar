import { brandRepository } from "@server/catalog/brand.repository";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { fillFacts, levelsOf, type Answers, type Filled } from "./fill-facts";
import { FACT_DECLARATIONS, type FactKey, type MeasureKey } from "./listing-facts";
import { orgListingDefaultsRepository } from "./org-listing-defaults.repository";
import { productFamilyRepository } from "./product-family.repository";
import { resolveProductType } from "./product-type";
import { productTypeRepository } from "./product-type.repository";
import type { ProductTypeRecord } from "./product-type.types";

/**
 * What a product carries after a save
 * ([inherited-facts](../../docs/specs/listing-vocabulary/inherited-facts/) R1, D1, D2).
 *
 * This is the fill step's one caller: it gathers the levels — the family, the brand, the org's
 * defaults — asks `fillFacts` to walk them in order, and hands back what to store. The walking
 * itself stays pure in `fill-facts.ts`; what lives here is the reading.
 *
 * It runs on **save** and never on read. A product read is one row, and what gets published must
 * be reproducible from that row alone (listing-vocabulary trd D4) — a listing sent to a
 * marketplace last month must not re-derive differently today because a brand changed since.
 */

export interface ListingFillInput {
  categoryId: string;
  orgId: string;
  familyId?: string | null;
  brandId?: string | null;
  /** What the shop answered on the product itself. Anything blank is filled from the levels. */
  facts?: Answers<FactKey>;
  measurements?: Answers<MeasureKey>;
}

export interface ListingFillResult {
  /** The resolved type, stored on the product so merchandising cannot move it (categories D1b). */
  productType: string | null;
  facts: Filled<FactKey>;
  measurements: Filled<MeasureKey>;
  /** What the type asks and nothing answered — reported, never a reason to refuse a save. */
  unanswered: FactKey[];
}

/**
 * The brand's facts, as answers. A brand carries the statutory ones a shop states once —
 * manufacturer, packer, origin — which is most of what a marketplace demands and none of what a
 * product form should ask per product.
 *
 * A **retired** brand still answers (D6): retiring hides it from the pickers, never from the
 * fill step, and a product that named it must read exactly as before.
 */
/**
 * A family stores its facts the way a product does — each with the level that supplied it — so
 * reading one *as a level* means taking the value back out. Passing the stored entry straight
 * through would make the answer `{value, origin}` rather than `crepe`.
 */
function answersFrom(stored: unknown): Answers<string> | null {
  if (!stored || typeof stored !== "object") return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(stored as Record<string, unknown>)) {
    if (entry && typeof entry === "object" && "value" in entry) {
      const value = (entry as { value: unknown }).value;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        out[key] = value;
      }
    }
  }
  return out;
}

async function brandAnswers(brandId: string | null | undefined, orgId: string) {
  if (!brandId) return null;
  const brand = await brandRepository.findById(orgId, brandId);
  if (!brand) return null;
  return {
    countryOfOrigin: brand.countryOfOrigin,
    manufacturer: brand.manufacturer,
    packerOrImporter: brand.packerOrImporter,
  } as Answers<string>;
}

/**
 * Everything a product should carry once saved.
 *
 * The type is resolved from the category tree and stored; the facts it declares are filled from
 * the levels in order and stored with the level that answered. A product whose tree declares no
 * type is asked nothing and still saves (parent spec R5) — that is the untyped catalogue, not an
 * error.
 */
export async function fillListing(input: ListingFillInput): Promise<ListingFillResult> {
  const productType = resolveProductType(input.categoryId, await categoryRepository.list());
  const type: ProductTypeRecord | null = await productTypeRepository.byKey(productType);

  if (!type) {
    // No questions to ask, so nothing to fill. Anything the caller sent is still kept as its
    // own answer rather than discarded — a shop's data is not ours to drop.
    return {
      productType,
      facts: fillFacts<FactKey>(input.facts ?? {}, [], Object.keys(input.facts ?? {}) as FactKey[]),
      measurements: fillFacts<MeasureKey>(
        input.measurements ?? {},
        [],
        Object.keys(input.measurements ?? {}) as MeasureKey[],
      ),
      unanswered: [],
    };
  }

  const [family, brand, defaults] = await Promise.all([
    input.familyId ? productFamilyRepository.byId(input.orgId, input.familyId) : null,
    brandAnswers(input.brandId, input.orgId),
    orgListingDefaultsRepository.findByOrgId(input.orgId),
  ]);

  const familyFacts = answersFrom(family?.facts) as Answers<FactKey> | null;
  const familyMeasures = answersFrom(family?.measurements) as Answers<MeasureKey> | null;

  // The org's defaults answer what belongs to no brand — origin, and the tax code for the
  // category being listed in (org-profile R4).
  const defaultAnswers = defaults
    ? ({ countryOfOrigin: defaults.countryOfOrigin } as Answers<string>)
    : null;

  const facts = fillFacts<FactKey>(
    input.facts ?? {},
    levelsOf<FactKey>(
      familyFacts,
      brand as Answers<FactKey> | null,
      defaultAnswers as Answers<FactKey> | null,
    ),
    type.facts,
  );

  const measurements = fillFacts<MeasureKey>(
    input.measurements ?? {},
    levelsOf<MeasureKey>(familyMeasures, null, null),
    type.measures.map((m) => m.key),
  );

  return {
    productType,
    facts,
    measurements,
    unanswered: type.facts.filter((fact) => facts[fact] === undefined),
  };
}

/** What a screen shows beside a filled-in fact: the wording this type uses for it. */
export function factLabel(type: ProductTypeRecord | null, fact: FactKey): string {
  const fallback = FACT_DECLARATIONS[fact]?.label ?? fact;
  return type?.factLabels[fact] ?? fallback;
}
