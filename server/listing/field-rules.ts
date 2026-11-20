import { FACT, MEASURE, type MeasureKey } from "./listing-facts";

/**
 * Named rules a map may use (listing-model/field-maps D2): a channel value worked out from answers the
 * shop already gave, so nothing new is asked. Pure; each returns its value in the words of the channel
 * it was written for (Amazon's department, Google's age group), which pairing matches to another
 * channel's words by letters (Q10), or null when the product does not tell.
 */

export interface RuleContext {
  /** Our answers by attribute key: an option key for a choice, else the value as typed. */
  answer(key: string): string | null;
  /** A measurement in the unit the product type fixes. */
  measure(key: MeasureKey): { value: number; unit: string } | null;
  /** The size label the type reads from its measurements, if any (product-types D9). */
  sizeLabel: string | null;
}

export interface RuleValue {
  value: string;
  unit?: string;
}

type Rule = (ctx: RuleContext) => RuleValue | null;

const FEMALE = new Set(["women", "girls", "baby-girls", "kids-girls"]);
const MALE = new Set(["men", "boys", "baby-boys", "kids-boys"]);
const BABY = new Set(["baby-boys", "baby-girls", "baby-boys-baby-girls"]);
const CHILD = new Set(["boys", "girls", "boys-girls", "kids", "kids-boys", "kids-girls"]);

const audience = (ctx: RuleContext) => ctx.answer(FACT.AUDIENCE);
const value = (v: string | null): RuleValue | null => (v ? { value: v } : null);

/** Amazon's department words, from its HANDBAG schema's `department` list (2026-11-08). */
const DEPARTMENT: Record<string, string> = {
  women: "Womens", men: "Mens", girls: "Girls", "kids-girls": "Girls", boys: "Boys", "kids-boys": "Boys",
  "baby-girls": "Baby Girls", "baby-boys": "Baby Boys", "baby-boys-baby-girls": "Unisex Baby",
  "boys-girls": "Unisex Kids", kids: "Unisex Kids", unisex: "Unisex", "men-women": "Unisex",
};

/** Free Size is a permitted value on every category this store sells into (size-label.ts). */
export const FREE_SIZE_WORDS = "Free Size";

/** The size a buyer filters by: the type's label, else Free Size (channel-catalogue Q8). */
const sizeLabel: Rule = (ctx) => value(ctx.sizeLabel && ctx.sizeLabel !== "Free" ? ctx.sizeLabel : FREE_SIZE_WORDS);

export const FIELD_RULES = {
  /** Women → Womens (spec A2). */
  department_from_audience: (ctx) => {
    const a = audience(ctx);
    return value(a ? (DEPARTMENT[a] ?? null) : null);
  },
  /** Adult unless the audience is children or babies (spec A2). */
  age_range_from_audience: (ctx) => {
    const a = audience(ctx);
    if (!a) return null;
    return value(BABY.has(a) ? "Baby" : CHILD.has(a) ? "Kid" : "Adult");
  },
  /** female / male / unisex: Google's and Meta's words, and Amazon's in its own case (channel-catalogue Q8). */
  gender_from_audience: (ctx) => {
    const a = audience(ctx);
    if (!a) return null;
    return value(FEMALE.has(a) ? "female" : MALE.has(a) ? "male" : "unisex");
  },
  /** Google's age groups: infant for babies, kids for children, else adult (channel-catalogue Q8). */
  age_group_from_audience: (ctx) => {
    const a = audience(ctx);
    if (!a) return null;
    return value(BABY.has(a) ? "infant" : CHILD.has(a) ? "kids" : "adult");
  },
  size_label: sizeLabel,
  /** "30 x 12 x 25 cm" from length, width and height, or "60 x 40 cm" without a height; else the size label (Amazon `size_info`, `size`). */
  size_display_from_measures: (ctx): RuleValue | null => {
    const dims = [MEASURE.LENGTH, MEASURE.WIDTH, MEASURE.HEIGHT].map((k) => ctx.measure(k));
    // A flat thing (a rug, a prayer mat) has no height: its size is length x width.
    const known = dims[2] === null ? dims.slice(0, 2) : dims;
    if (known.every((d) => d !== null) && new Set(known.map((d) => d!.unit)).size === 1) {
      return value(`${known.map((d) => d!.value).join(" x ")} ${known[0]!.unit}`);
    }
    return sizeLabel(ctx);
  },
} satisfies Record<string, Rule>;

export type RuleKey = keyof typeof FIELD_RULES;
export const RULE_KEYS = Object.keys(FIELD_RULES) as RuleKey[];
export const isRuleKey = (key: string): key is RuleKey => Object.hasOwn(FIELD_RULES, key);
