import { ORIGIN, type Origin } from "./listing-facts";

/**
 * Filling a fact the shop left blank, from the family, then the brand, then the shop's defaults
 * (listing-vocabulary/inherited-facts R1, D1).
 *
 * An ordered list asked in turn, first answer winning, each answer remembering which level gave
 * it. Precedence lives in the order of the list rather than inside branching code, so adding a
 * level is inserting an entry rather than editing every fact's fallback — and so that *which
 * level answered* survives, which the brand-level correction depends on (R5).
 *
 * It runs on save and never on read: a product read is one row, and what gets published must be
 * reproducible from that row alone (parent trd D4).
 */

export type Answerable = string | number | boolean;

export interface FilledAnswer {
  value: Answerable;
  origin: Origin;
  /** What a marketplace said, when it supplied or once supplied this answer (marketplace-facts Q31). */
  source?: { channel: string; value: string; readAt: string; chosen?: boolean };
}

export interface Level<K extends string> {
  origin: Origin;
  /** What this level can answer. A key it does not carry is a key it cannot answer. */
  answers: Partial<Record<K, Answerable | null | undefined>>;
}

export type Answers<K extends string> = Partial<Record<K, Answerable | null | undefined>>;
export type Filled<K extends string> = Partial<Record<K, FilledAnswer>>;

/**
 * Blank is not an answer: an empty string is a field somebody cleared, not a value to inherit.
 *
 * Exported because the readiness gate asks the same question of a stored answer, and a second
 * spelling of "blank" is how a fact counts as answered here and missing there.
 */
export function answered(value: Answerable | null | undefined): value is Answerable {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

/**
 * The product's own answers, with anything it left blank filled from the levels in order.
 *
 * `own` wins outright and is always recorded as the product's: answering on the product is an
 * override, and that is what later leaves it alone when a brand is corrected (R4, R5).
 */
export function fillFacts<K extends string>(
  own: Answers<K>,
  levels: readonly Level<K>[],
  keys: readonly K[],
): Filled<K> {
  const filled: Filled<K> = {};
  for (const key of keys) {
    const mine = own[key];
    if (answered(mine)) {
      filled[key] = { value: mine, origin: ORIGIN.PRODUCT };
      continue;
    }
    for (const level of levels) {
      const value = level.answers[key];
      if (answered(value)) {
        filled[key] = { value, origin: level.origin };
        break;
      }
    }
    // Absent everywhere is absent, not blank. Nothing here blocks saving (parent spec R5); the
    // product is told what is missing instead.
  }
  return filled;
}

/**
 * The keys whose stored answer came from `origin` and has not since been overridden — exactly
 * the products a correction at that level should offer to change (R5).
 */
export function answeredBy<K extends string>(filled: Filled<K>, origin: Origin): K[] {
  return (Object.keys(filled) as K[]).filter((key) => filled[key]?.origin === origin);
}

/**
 * Re-filling after an edit: a key the shop has just answered becomes the product's own, in the
 * same write that stores the value (D4).
 *
 * Separate from `fillFacts` because an edit is not a save of a blank field — it has to clear the
 * mark even where the new value happens to equal the inherited one, or the next correction at
 * that level would silently revert a deliberate choice.
 */
export function takeOwnership<K extends string>(
  filled: Filled<K>,
  // NoInfer so the key set comes from the stored answers, not from whichever handful was edited —
  // otherwise editing one field narrows the returned type to that one field.
  edited: readonly NoInfer<K>[],
): Filled<K> {
  const next: Filled<K> = { ...filled };
  for (const key of edited) {
    const current = next[key];
    if (current) next[key] = { value: current.value, origin: ORIGIN.PRODUCT };
  }
  return next;
}

/**
 * After a save, a marketplace's answer keeps its mark where the shop left it unchanged, and its
 * words stay beside an answer the shop changed (marketplace-facts Q31). The form sends every answer
 * back, so without this the first save would turn every marketplace answer into the product's own.
 */
export function keepMarketplace<K extends string>(filled: Filled<K>, stored: Partial<Record<K, FilledAnswer>> | null | undefined): Filled<K> {
  if (!stored) return filled;
  const next: Filled<K> = { ...filled };
  for (const key of Object.keys(stored) as K[]) {
    const before = stored[key];
    const now = next[key];
    if (!before?.source || !now) continue;
    next[key] =
      before.origin === ORIGIN.MARKETPLACE && now.origin === ORIGIN.PRODUCT && now.value === before.value
        ? before
        : { ...now, source: before.source };
  }
  return next;
}

/** The levels in the order they are asked. Named so a caller cannot accidentally reorder them. */
export function levelsOf<K extends string>(
  family: Answers<K> | null,
  brand: Answers<K> | null,
  defaults: Answers<K> | null,
): Level<K>[] {
  const levels: Level<K>[] = [];
  if (family) levels.push({ origin: ORIGIN.FAMILY, answers: family });
  // A retired brand still answers: retiring it hides it from pickers, never from the fill step
  // (D6), and a product that named it must not be blanked.
  if (brand) levels.push({ origin: ORIGIN.BRAND, answers: brand });
  if (defaults) levels.push({ origin: ORIGIN.DEFAULTS, answers: defaults });
  return levels;
}
