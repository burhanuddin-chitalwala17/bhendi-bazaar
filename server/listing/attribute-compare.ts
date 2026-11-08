import { parseStoredFacts, parseStoredMeasurements, type MeasureKey } from "./listing-facts";
import { canonicalOf, convert } from "./units";

/**
 * Every answer a product held before the move against its value rows after it (listing-model/attributes
 * D9, A3, parent Q33): by count and by value. Pure; the compare script feeds it batches. Brand and shop
 * values are derived, not moved, so they are not compared here.
 */

export interface CompareProduct {
  id: string;
  productType: string | null;
  facts: unknown;
  measurements: unknown;
  weight: number | null;
  /** The unit each of the type's measurements is in. */
  measureUnits: Partial<Record<MeasureKey, string>>;
}

export interface CompareRow {
  attributeKey: string;
  /** A measurement row; a fact and a measurement may share a key (dynamic-form Q16). */
  measured?: boolean;
  optionKey: string | null;
  text: string | null;
  number: string | null;
  bool: boolean | null;
}

export interface Mismatch {
  productId: string;
  key: string;
  before: string;
  after: string | null;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a));

/** What a row holds, as one comparable string. */
function held(row: CompareRow | undefined): string | null {
  if (!row) return null;
  return row.optionKey ?? row.text ?? (row.number !== null ? String(Number(row.number)) : row.bool !== null ? String(row.bool) : null);
}

export function compareProduct(product: CompareProduct, rows: readonly CompareRow[]): { answers: number; mismatches: Mismatch[] } {
  const byKey = new Map(rows.filter((r) => !r.measured).map((r) => [r.attributeKey, r]));
  const byMeasure = new Map(rows.filter((r) => r.measured || r.attributeKey === "weight").map((r) => [r.attributeKey, r]));
  const mismatches: Mismatch[] = [];
  let answers = 0;
  const miss = (key: string, before: string, after: string | null) => mismatches.push({ productId: product.id, key, before, after });

  for (const [key, fact] of Object.entries(parseStoredFacts(product.facts))) {
    if (!fact || fact.value === "" || fact.value === null || fact.value === undefined) continue;
    answers++;
    const before = String(fact.value);
    const after = held(byKey.get(key));
    const same = after !== null && (after === before || (Number.isFinite(Number(before)) && Number.isFinite(Number(after)) && close(Number(before), Number(after))));
    if (!same) miss(key, before, after);
  }

  for (const [key, m] of Object.entries(parseStoredMeasurements(product.measurements)) as Array<[MeasureKey, { value: number }]>) {
    answers++;
    const unit = product.measureUnits[key];
    const row = byMeasure.get(key) ?? byKey.get(key);
    const canonical = unit ? convert(m.value, unit, canonicalOf(unit)!) : null;
    const ok = row && (canonical !== null ? row.number !== null && close(Number(row.number), canonical) : held(row) === String(m.value));
    if (!ok) miss(key, `${m.value}${unit ? ` ${unit}` : ""}`, held(row));
  }

  if (product.weight !== null) {
    answers++;
    const row = byKey.get("weight");
    const ok = row && row.number !== null ? close(Number(row.number), product.weight * 1000) : held(row) === String(product.weight);
    if (!ok) miss("weight", `${product.weight} kg`, held(row));
  }
  return { answers, mismatches };
}
