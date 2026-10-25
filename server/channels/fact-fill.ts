import type { ListingAttributes } from "./providers/listing-read";
import { nameSimilarity } from "./listing-match";

/**
 * Filling a product from one marketplace listing (marketplace-facts D5). Pure: the caller hands it
 * the listing's read, the marketplace's mapping rows, the product and our answer lists, and writes
 * what it answers. The same for every marketplace: nothing here knows which one it is (Q4).
 */

export interface FillMapping {
  types: ReadonlyArray<{ productType: string; kind: string | null; theirCategory: string }>;
  attributes: ReadonlyArray<{ theirCategory: string; fact: string; theirAttribute: string; checkedOn: Date }>;
  values: ReadonlyArray<{ list: string; valueKey: string; theirValue: string }>;
}

export interface FillFact {
  key: string;
  answer: "choice" | "text" | "number" | "boolean";
  list?: string;
}

export interface FillProduct {
  /** From the product's category; null when its category has none (Q9, Q20). */
  productType: string | null;
  facts: Readonly<Record<string, { value: unknown } | undefined>>;
  measurements: Readonly<Record<string, { value: unknown } | undefined>>;
}

export interface FillType {
  facts: readonly FillFact[];
  measures: ReadonlyArray<{ key: string; unit: string }>;
}

export type TypeOutcome =
  | { kind: "own"; productType: string }
  | { kind: "mapped"; productType: string }
  | { kind: "choose"; productTypes: string[] }
  | { kind: "none"; marketplaceType: string }
  | { kind: "unknown" };

export interface FactFill {
  key: string;
  value: string | number | boolean;
  /** The marketplace's words this answer came from. */
  said: string;
}

export interface FactQuestion {
  fact: string;
  said: string;
  /** Our answers, the likeliest first. */
  options: Array<{ key: string; label: string }>;
}

export interface FillPlan {
  type: TypeOutcome;
  facts: FactFill[];
  measurements: FactFill[];
  questions: FactQuestion[];
  /** The oldest checked date among the mapping's rows for this marketplace type (Q8). */
  oldestCheck: Date | null;
}

const OPTIONS_SHOWN = 8;
export const SAID_MAX = 500;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const answered = (entry: { value: unknown } | undefined) =>
  entry !== undefined && entry.value !== null && entry.value !== undefined && String(entry.value).trim() !== "";

/** Our type for a marketplace type: ours if the product has one, else what the mapping says (Q9, Q11, Q6). */
export function typeFor(product: FillProduct, marketplaceType: string | null, mapping: FillMapping): TypeOutcome {
  if (product.productType) return { kind: "own", productType: product.productType };
  if (!marketplaceType) return { kind: "unknown" };
  const ours = [...new Set(mapping.types.filter((t) => t.theirCategory === marketplaceType).map((t) => t.productType))];
  if (ours.length === 1) return { kind: "mapped", productType: ours[0] };
  if (ours.length > 1) return { kind: "choose", productTypes: ours.sort() };
  return { kind: "none", marketplaceType };
}

/** Our answers that a marketplace's words name exactly: a mapped value, or our own answer's words (Q22). */
export function answersNamed(
  said: readonly string[],
  list: string,
  mapping: FillMapping,
  ours: ReadonlyArray<{ key: string; label: string }>,
): string[] {
  const wanted = new Set(said.map(norm));
  const keys = new Set<string>();
  for (const row of mapping.values) if (row.list === list && wanted.has(norm(row.theirValue))) keys.add(row.valueKey);
  for (const value of ours) if (wanted.has(norm(value.label)) || wanted.has(norm(value.key))) keys.add(value.key);
  return [...keys];
}

/** Our answers ranked by closeness to the marketplace's words, the named ones first (Q22). */
function ranked(said: string, named: readonly string[], ours: ReadonlyArray<{ key: string; label: string }>) {
  const first = ours.filter((v) => named.includes(v.key));
  const rest = ours
    .filter((v) => !named.includes(v.key))
    .map((v) => ({ v, score: nameSimilarity(said, v.label) }))
    .sort((a, b) => b.score - a.score)
    .map((e) => e.v);
  return [...first, ...rest].slice(0, OPTIONS_SHOWN);
}

/** The words a yes-or-no answer is read from; a marketplace's own codes become these in its provider. */
const YES = new Set(["yes", "true"]);
const NO = new Set(["no", "false"]);
const TO_CM: Record<string, number> = { cm: 1, mm: 0.1, in: 2.54 };

/**
 * What one listing fills on one product (D5): only empty facts (Q2), only with a type the product
 * has, an exact answer filling and anything else asked, with skipped facts left alone (D6).
 */
export function planFill(input: {
  read: ListingAttributes;
  mapping: FillMapping;
  product: FillProduct;
  type: FillType | null;
  lists: Readonly<Record<string, ReadonlyArray<{ key: string; label: string }>>>;
  skips: readonly string[];
}): FillPlan {
  const { read, mapping, product, type, lists, skips } = input;
  const outcome = typeFor(product, read.type, mapping);
  const plan: FillPlan = { type: outcome, facts: [], measurements: [], questions: [], oldestCheck: null };
  const rows = read.type ? mapping.attributes.filter((a) => a.theirCategory === read.type) : [];
  for (const row of rows) if (!plan.oldestCheck || row.checkedOn < plan.oldestCheck) plan.oldestCheck = row.checkedOn;
  // Facts follow the product's own type only: an untyped product chooses its category first (Q20, Q25).
  if (outcome.kind !== "own" || !type) return plan;
  for (const fact of type.facts) {
    if (answered(product.facts[fact.key])) continue;
    const row = rows.find((r) => r.fact === fact.key);
    if (!row) continue;
    const said = [...(read.attributes[row.theirAttribute] ?? []), ...(read.attributes[`${row.theirAttribute}.standardized_values`] ?? [])];
    if (said.length === 0) continue;
    // The stored entry caps a marketplace's words at 500 characters; one over would empty the column.
    const words = said[0].slice(0, SAID_MAX);

    if (fact.answer === "number") {
      const n = Number.parseInt(words, 10);
      if (Number.isFinite(n) && n > 0) plan.facts.push({ key: fact.key, value: n, said: words });
      continue;
    }
    if (fact.answer === "boolean") {
      const answer = said.map(norm).find((w) => YES.has(w) || NO.has(w));
      if (answer) plan.facts.push({ key: fact.key, value: YES.has(answer), said: words });
      continue;
    }
    if (fact.answer === "text") {
      plan.facts.push({ key: fact.key, value: words, said: words });
      continue;
    }
    const ours = fact.list ? (lists[fact.list] ?? []) : [];
    const named = answersNamed(said, fact.list ?? "", mapping, ours);
    if (named.length === 1) {
      plan.facts.push({ key: fact.key, value: named[0], said: words });
    } else if (!skips.includes(fact.key) && ours.length > 0) {
      plan.questions.push({ fact: fact.key, said: words, options: ranked(words, named, ours) });
    }
  }

  const dims = read.details.dimensionsCm;
  if (dims) {
    for (const measure of type.measures) {
      if (!["length", "width", "height"].includes(measure.key) || answered(product.measurements[measure.key])) continue;
      const factor = TO_CM[measure.unit];
      if (!factor) continue;
      const cm = dims[measure.key as "length" | "width" | "height"];
      plan.measurements.push({ key: measure.key, value: Math.round((cm / factor) * 10) / 10, said: `${cm} cm` });
    }
  }
  return plan;
}

/** A mapping row checked longer ago than this reads "Check the mapping" (Q8). */
export const STALE_MAPPING_DAYS = 90;
export const mappingIsStale = (oldest: Date | null, now = new Date()) =>
  oldest !== null && now.getTime() - oldest.getTime() > STALE_MAPPING_DAYS * 24 * 60 * 60 * 1000;
