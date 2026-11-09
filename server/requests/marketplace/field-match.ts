import { FIELD_SOLUTION, type FieldSolution } from "./marketplace.types";

/**
 * Matching a marketplace attribute to one of our facts or to the product itself (setup-requests D6, D7).
 * Pure: the same names and allowed answers always give the same proposal, so a plan's hash is stable.
 */

export interface FactOption {
  key: string;
  label: string;
  /** The answers its list holds, by label; empty for text, number and yes/no facts. */
  answers: string[];
}

export interface FieldProposal {
  solution: FieldSolution;
  fact: string | null;
  source: string | null;
  constant: string | null;
}

/**
 * Lower-case words, our camelCase keys split (`itemForm` → item, form), with Amazon's `_type`, `_name`,
 * `_description` tails, its `item_` prefix and short joining words dropped: none says what a field is about,
 * and matching on one paired `item_dimensions` with Form.
 */
export function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !["type", "name", "description", "of", "the", "number", "item", "is", "in", "a", "an", "and", "or", "to", "for", "what"].includes(w));
}

/** One word standing for another: equal, or one a prefix of the other when both are real words (`pocket`/`pockets`), never `in`/`inner`. */
const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Attributes always answered from the product itself, by Amazon's name (Q32). */
const FROM_PRODUCT: Record<string, string> = {
  part_number: "sku",
  model_number: "sku",
  model_name: "name",
  item_type_name: "name",
  manufacturer: "brand",
};

/** How much two names share: the fraction of the attribute's words that the fact's words cover. */
function overlap(attribute: string, fact: FactOption): number {
  const a = words(attribute);
  if (a.length === 0) return 0;
  const f = new Set([...words(fact.key), ...words(fact.label)]);
  return a.filter((w) => [...f].some((x) => sameWord(w, x))).length / a.length;
}

/** How many of the marketplace's allowed answers our list already has, by label. */
function answerOverlap(allowed: readonly string[], fact: FactOption): number {
  if (allowed.length === 0 || fact.answers.length === 0) return 0;
  const ours = new Set(fact.answers.map((a) => a.toLowerCase()));
  return allowed.filter((a) => ours.has(a.toLowerCase())).length / allowed.length;
}

/**
 * One field's proposal: a fact the type asks (reuse), a declared fact it does not (add), the product
 * itself, a fixed value when Amazon allows exactly one answer, or nothing we can set up without code.
 */
export function propose(attribute: { name: string; label: string; allowed: readonly string[]; parts?: readonly string[] }, asked: readonly FactOption[], declared: readonly FactOption[]): FieldProposal {
  const source = FROM_PRODUCT[attribute.name];
  if (source) return { solution: FIELD_SOLUTION.FROM_PRODUCT, fact: null, source, constant: null };
  // A group of parts (inner → material, item_dimensions → length, width, height) takes a map per part, never
  // one answer: mapping one onto it sent Amazon a value it ignored and overwrote the weight (2026-11-09).
  if (attribute.parts && attribute.parts.length > 0) return { solution: FIELD_SOLUTION.NOT_POSSIBLE, fact: null, source: null, constant: null };
  const score = (f: FactOption) => Math.max(overlap(attribute.name, f), overlap(attribute.label, f)) + answerOverlap(attribute.allowed, f);
  const best = (pool: readonly FactOption[]) => pool.map((f) => ({ f, s: score(f) })).filter((x) => x.s >= 0.5).sort((x, y) => y.s - x.s || x.f.key.localeCompare(y.f.key))[0]?.f;
  const reuse = best(asked);
  if (reuse) return { solution: FIELD_SOLUTION.REUSE, fact: reuse.key, source: null, constant: null };
  const add = best(declared.filter((d) => !asked.some((a) => a.key === d.key)));
  if (add) return { solution: FIELD_SOLUTION.ADD, fact: add.key, source: null, constant: null };
  if (attribute.allowed.length === 1) return { solution: FIELD_SOLUTION.FIXED, fact: null, source: null, constant: attribute.allowed[0] };
  return { solution: FIELD_SOLUTION.NOT_POSSIBLE, fact: null, source: null, constant: null };
}

/** A stable key for an answer the marketplace allows that our list lacks (Q15): its words, joined. */
export function valueKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** A plan's fingerprint (D7): Apply refuses when the inputs it was built from have moved. */
export function planHash(parts: unknown): string {
  const text = JSON.stringify(parts);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
