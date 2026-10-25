import { z } from "zod";

/**
 * The facts a product type may ask about, beyond the spine every product carries
 * (listing-vocabulary/categories R3, parent trd D1).
 *
 * A fact is here because the shop can answer it by looking at the product, without knowing
 * which platform is asking ([ADR-0047](../../docs/adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)).
 * One platform asking is enough; a field that exists only to satisfy a platform's own machinery
 * — Flipkart's procurement terms, Meesho's returns price — is not here and belongs to an adapter.
 */
export const FACT = {
  COLOUR: "colour",
  PATTERN: "pattern",
  /** Flipkart asks cloth "Fabric" and everything else "Material"; it is one question, so a type relabels it. */
  MATERIAL: "material",
  PACK_QUANTITY: "packQuantity",
  AUDIENCE: "audience",
  OCCASION: "occasion",
  SLEEVE_LENGTH: "sleeveLength",
  SLEEVE_STYLING: "sleeveStyling",
  STITCH_TYPE: "stitchType",
  FIT: "fit",
  WAIST_RISE: "waistRise",
  WAIST_CLOSURE: "waistClosure",
  SURFACE_STYLING: "surfaceStyling",
  SHAPE: "shape",
  CARE: "care",
  CLOSURE: "closure",
  COMPARTMENTS: "compartments",
  WATER_RESISTANT: "waterResistant",
  STRAP: "strap",
  STRAP_PADDING: "strapPadding",
  SCENT_FAMILY: "scentFamily",
  SHELF_LIFE_MONTHS: "shelfLifeMonths",
  PLATING: "plating",
  BASE_MATERIAL: "baseMaterial",
  PURITY: "purity",
  CERTIFICATION: "certification",
  GEMSTONE: "gemstone",
  CONTENTS: "contents",
} as const;

export const FACTS = Object.values(FACT);
export type FactKey = (typeof FACTS)[number];

/**
 * How a fact is answered. `choice` draws on a named value list held as data, because colours
 * grow the first time a shop sells one and waiting for a deploy is the friction this phase
 * removes (categories D3).
 */
export const ANSWER = {
  CHOICE: "choice",
  TEXT: "text",
  NUMBER: "number",
  BOOLEAN: "boolean",
} as const;
export const ANSWERS = [
  ANSWER.CHOICE,
  ANSWER.TEXT,
  ANSWER.NUMBER,
  ANSWER.BOOLEAN,
] as const;
export type AnswerKind = (typeof ANSWERS)[number];

/** The channels that mark a fact compulsory somewhere, read off their own templates. */
export const PLATFORM = {
  AMAZON: "amazon",
  FLIPKART: "flipkart",
  MEESHO: "meesho",
} as const;
export const PLATFORMS = Object.values(PLATFORM);
export type Platform = (typeof PLATFORMS)[number];

export interface FactDeclaration {
  key: FactKey;
  /** The default wording; a product type may override it where its trade uses another word. */
  label: string;
  answer: AnswerKind;
  /** For `choice`: which value list the answers come from. Several facts share one list. */
  list?: string;
  hint?: string;
  /**
   * Which marketplaces mark this compulsory in at least one of their categories, measured from
   * the templates in `listing-node-templates/` on 2026-10-03.
   *
   * It is not a rule — a fact is admitted because the shop can answer it, never because a
   * platform asks ([ADR-0047](../../docs/adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)).
   * It is shown when somebody builds a type, so leaving a fact out is a decision taken with the
   * consequence in view rather than an omission discovered at the first rejection
   * (product-types D7).
   */
  requiredBy: readonly Platform[];
}

/** The value lists facts draw on. A list is global and a product type says which of it applies (categories D5). */
export const LIST = {
  COLOUR: "colour",
  PATTERN: "pattern",
  MATERIAL: "material",
  AUDIENCE: "audience",
  OCCASION: "occasion",
  SLEEVE_LENGTH: "sleeveLength",
  SLEEVE_STYLING: "sleeveStyling",
  STITCH_TYPE: "stitchType",
  FIT: "fit",
  WAIST_RISE: "waistRise",
  WAIST_CLOSURE: "waistClosure",
  SURFACE_STYLING: "surfaceStyling",
  SHAPE: "shape",
  CARE: "care",
  CLOSURE: "closure",
  STRAP: "strap",
  STRAP_PADDING: "strapPadding",
  SCENT_FAMILY: "scentFamily",
  PLATING: "plating",
  BASE_MATERIAL: "baseMaterial",
  PURITY: "purity",
  CERTIFICATION: "certification",
  GEMSTONE: "gemstone",
} as const;

export const LISTS = Object.values(LIST);
export type ListKey = (typeof LISTS)[number];

export const FACT_DECLARATIONS: Readonly<Record<FactKey, FactDeclaration>> = {
  [FACT.COLOUR]: {
    key: FACT.COLOUR,
    label: "Colour",
    answer: ANSWER.CHOICE,
    list: LIST.COLOUR,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.PATTERN]: {
    key: FACT.PATTERN,
    label: "Pattern",
    answer: ANSWER.CHOICE,
    list: LIST.PATTERN,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.MATERIAL]: {
    key: FACT.MATERIAL,
    label: "Material",
    answer: ANSWER.CHOICE,
    list: LIST.MATERIAL,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.PACK_QUANTITY]: {
    key: FACT.PACK_QUANTITY,
    label: "Pack of",
    answer: ANSWER.NUMBER,
    hint: "How many come in one pack",
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.AUDIENCE]: {
    key: FACT.AUDIENCE,
    label: "Ideal for",
    answer: ANSWER.CHOICE,
    list: LIST.AUDIENCE,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.OCCASION]: {
    key: FACT.OCCASION,
    label: "Occasion",
    answer: ANSWER.CHOICE,
    list: LIST.OCCASION,
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.SLEEVE_LENGTH]: {
    key: FACT.SLEEVE_LENGTH,
    label: "Sleeve length",
    answer: ANSWER.CHOICE,
    list: LIST.SLEEVE_LENGTH,
    requiredBy: [PLATFORM.MEESHO],
  },
  [FACT.SLEEVE_STYLING]: {
    key: FACT.SLEEVE_STYLING,
    label: "Sleeve styling",
    answer: ANSWER.CHOICE,
    list: LIST.SLEEVE_STYLING,
    requiredBy: [PLATFORM.MEESHO],
  },
  [FACT.STITCH_TYPE]: {
    key: FACT.STITCH_TYPE,
    label: "Stitch",
    answer: ANSWER.CHOICE,
    list: LIST.STITCH_TYPE,
    requiredBy: [PLATFORM.MEESHO],
  },
  [FACT.FIT]: {
    key: FACT.FIT,
    label: "Fit",
    answer: ANSWER.CHOICE,
    list: LIST.FIT,
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.WAIST_RISE]: {
    key: FACT.WAIST_RISE,
    label: "Waist rise",
    answer: ANSWER.CHOICE,
    list: LIST.WAIST_RISE,
    requiredBy: [PLATFORM.MEESHO],
  },
  [FACT.WAIST_CLOSURE]: {
    key: FACT.WAIST_CLOSURE,
    label: "Waist closure",
    answer: ANSWER.CHOICE,
    list: LIST.WAIST_CLOSURE,
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.SURFACE_STYLING]: {
    key: FACT.SURFACE_STYLING,
    label: "Surface styling",
    answer: ANSWER.CHOICE,
    list: LIST.SURFACE_STYLING,
    requiredBy: [],
  },
  [FACT.SHAPE]: {
    key: FACT.SHAPE,
    label: "Shape",
    answer: ANSWER.CHOICE,
    list: LIST.SHAPE,
    requiredBy: [PLATFORM.MEESHO],
  },
  [FACT.CARE]: {
    key: FACT.CARE,
    label: "Care",
    answer: ANSWER.CHOICE,
    list: LIST.CARE,
    requiredBy: [],
  },
  [FACT.CLOSURE]: {
    key: FACT.CLOSURE,
    label: "Closure",
    answer: ANSWER.CHOICE,
    list: LIST.CLOSURE,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.COMPARTMENTS]: {
    key: FACT.COMPARTMENTS,
    label: "Compartments",
    answer: ANSWER.NUMBER,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.WATER_RESISTANT]: {
    key: FACT.WATER_RESISTANT,
    label: "Water resistant",
    answer: ANSWER.BOOLEAN,
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.STRAP]: {
    key: FACT.STRAP,
    // Flipkart's question: does the strap come off. Meesho asks a different one about the same
    // strap — whether it is padded — which is `strapPadding`, not a second word for this.
    label: "Strap",
    answer: ANSWER.CHOICE,
    list: LIST.STRAP,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.MEESHO],
  },
  [FACT.STRAP_PADDING]: {
    key: FACT.STRAP_PADDING,
    label: "Strap padding",
    answer: ANSWER.CHOICE,
    list: LIST.STRAP_PADDING,
    requiredBy: [PLATFORM.MEESHO],
  },
  [FACT.SCENT_FAMILY]: {
    key: FACT.SCENT_FAMILY,
    label: "Scent family",
    answer: ANSWER.CHOICE,
    list: LIST.SCENT_FAMILY,
    requiredBy: [PLATFORM.AMAZON, PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.SHELF_LIFE_MONTHS]: {
    key: FACT.SHELF_LIFE_MONTHS,
    label: "Shelf life",
    answer: ANSWER.NUMBER,
    hint: "Months from manufacture — Meesho requires it for anything applied to the body",
    requiredBy: [PLATFORM.MEESHO],
  },
  [FACT.PLATING]: {
    key: FACT.PLATING,
    label: "Plating",
    answer: ANSWER.CHOICE,
    list: LIST.PLATING,
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.BASE_MATERIAL]: {
    key: FACT.BASE_MATERIAL,
    label: "Base metal",
    answer: ANSWER.CHOICE,
    list: LIST.BASE_MATERIAL,
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.PURITY]: {
    key: FACT.PURITY,
    label: "Purity",
    answer: ANSWER.CHOICE,
    list: LIST.PURITY,
    requiredBy: [PLATFORM.FLIPKART],
  },
  [FACT.CERTIFICATION]: {
    key: FACT.CERTIFICATION,
    label: "Certification",
    answer: ANSWER.CHOICE,
    list: LIST.CERTIFICATION,
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
  [FACT.GEMSTONE]: {
    key: FACT.GEMSTONE,
    label: "Gemstone",
    answer: ANSWER.CHOICE,
    list: LIST.GEMSTONE,
    requiredBy: [PLATFORM.FLIPKART],
  },
  [FACT.CONTENTS]: {
    key: FACT.CONTENTS,
    label: "What is in the set",
    answer: ANSWER.TEXT,
    hint: "Named, not linked — a combo is its own product (variants D4)",
    requiredBy: [PLATFORM.FLIPKART, PLATFORM.MEESHO],
  },
};

/**
 * Measurements, stored as numbers against a unit the product type fixes (categories D6).
 * Stored rather than a size label because the label derives from these and never the reverse,
 * and because twelve of Meesho's nineteen nodes require a measurement while none requires a
 * label without one ([ADR-0047](../../docs/adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md) D4).
 */
export const MEASURE = {
  LENGTH: "length",
  WIDTH: "width",
  HEIGHT: "height",
  BUST: "bust",
  WAIST: "waist",
  HIP: "hip",
  SHOULDER: "shoulder",
  SLEEVE: "sleeve",
  DIAMETER: "diameter",
  CAPACITY: "capacity",
} as const;

export const MEASURES = Object.values(MEASURE);
export type MeasureKey = (typeof MEASURES)[number];

/** Fixed per product type, never chosen per product — a free unit is how inches and centimetres share a column. */
export const UNIT = {
  INCH: "in",
  CM: "cm",
  MM: "mm",
  ML: "ml",
  GRAM: "g",
} as const;
export const UNITS = Object.values(UNIT);
export type Unit = (typeof UNITS)[number];

export interface MeasureDeclaration {
  key: MeasureKey;
  label: string;
  unit: Unit;
  /** A measurement the shop must give for the type to be publishable anywhere. */
  required: boolean;
}

export const factKeySchema = z.enum(
  FACTS as unknown as [FactKey, ...FactKey[]],
);
export const measureKeySchema = z.enum(
  MEASURES as unknown as [MeasureKey, ...MeasureKey[]],
);

/** A stored answer and the level that supplied it, together, so origin costs no second column (parent trd D3). */
export const ORIGIN = {
  PRODUCT: "product",
  FAMILY: "family",
  BRAND: "brand",
  DEFAULTS: "defaults",
  /** Filled from a linked marketplace listing (marketplace-facts Q7). */
  MARKETPLACE: "marketplace",
} as const;
export const ORIGINS = Object.values(ORIGIN);
export type Origin = (typeof ORIGINS)[number];

/**
 * What a marketplace said, kept beside the answer (marketplace-facts Q7, Q31): the marketplace, its
 * words, when it was read, and whether the owner chose this answer among several. It stays when the
 * owner changes the answer, so "was Crepe from Amazon" and "Reset to Amazon's answer" still work.
 */
export const marketplaceSourceSchema = z.object({
  channel: z.string().min(1).max(40),
  value: z.string().max(500),
  readAt: z.string().max(40),
  chosen: z.boolean().optional(),
});
export type MarketplaceSource = z.infer<typeof marketplaceSourceSchema>;

export const storedFactSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  origin: z.enum(ORIGINS as unknown as [Origin, ...Origin[]]),
  /** True when the answer matched no permitted value and was kept rather than discarded (categories D8). */
  unlisted: z.boolean().optional(),
  source: marketplaceSourceSchema.optional(),
});

export type StoredFact = z.infer<typeof storedFactSchema>;

/**
 * The product's type-specific tail, as one indexed JSON column (parent trd D2). Partial because
 * a product answers what it can and nothing here blocks saving (parent spec R5).
 */
export const storedFactsSchema = z.partialRecord(
  factKeySchema,
  storedFactSchema,
);
export type StoredFacts = z.infer<typeof storedFactsSchema>;

/** A stored tail read defensively: anything that does not parse reads as no facts, never as a throw. */
export function parseStoredFacts(value: unknown): StoredFacts {
  if (value === null || value === undefined) return {};
  const parsed = storedFactsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/** Measurements keyed by measure, not fact: read through the fact schema, every entry fails and the whole column reads as empty. */
export const storedMeasurementsSchema = z.partialRecord(
  measureKeySchema,
  z.object({ value: z.number(), origin: z.enum(ORIGINS as unknown as [Origin, ...Origin[]]), source: marketplaceSourceSchema.optional() }),
);
export type StoredMeasurements = z.infer<typeof storedMeasurementsSchema>;

export function parseStoredMeasurements(value: unknown): StoredMeasurements {
  if (value === null || value === undefined) return {};
  const parsed = storedMeasurementsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
