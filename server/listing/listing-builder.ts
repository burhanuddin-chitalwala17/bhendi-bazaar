import { FIELD_REQUIREMENT, FIELD_KIND } from "./channel-catalogue.types";
import type { CatalogueFieldRow } from "./channel-catalogue.repository";
import { FIELD_RULES, isRuleKey, type RuleContext, type RuleValue } from "./field-rules";
import {
  ANY_BB_TYPE, CORE_KEY, FIELD_SOURCE, GAP_REASON, SHOP_KEY, fieldOf,
  type BuildGap, type BuiltField, type BuiltListing, type FieldMapRow,
} from "./field-map.types";
import { MEASURES, type MeasureKey, type StoredFacts } from "./listing-facts";
import { convert } from "./units";

/**
 * A channel listing built from a product and the maps (listing-model/field-maps D3, spec R5). Pure: the
 * caller loads every input once per batch (hazard *cost*) and hands the same maps to every product, so a
 * send uses the maps it was built with (hazard *a map changed while sending*).
 */

export interface BuildProduct {
  name: string;
  sku: string;
  description: string;
  brand: string | null;
  /** `Product.weight`, kilograms. */
  weightKg: number | null;
  barcode: string | null;
  kind: string | null;
  facts: StoredFacts;
  /** Measurements in the units the product type fixes. */
  measurements: Partial<Record<MeasureKey, { value: number; unit: string }>>;
  sizeLabel: string | null;
  hsn: string | null;
}

export interface BuildInput {
  /** The channel type's live fields; empty when the channel was never read (every map then builds). */
  fields: readonly CatalogueFieldRow[];
  /** The maps for this channel type, already chosen for our type (`mapsFor`). */
  maps: readonly FieldMapRow[];
  product: BuildProduct;
  /** An option's label, for pairing by words (Q10). */
  labelOf: (attributeKey: string, optionKey: string) => string | null;
}

/** Per field path, our type's own map over the one for every type (Q7). */
export function mapsFor(maps: readonly FieldMapRow[], bbType: string | null): FieldMapRow[] {
  const byPath = new Map<string, FieldMapRow>();
  for (const map of maps) {
    if (map.bbType !== ANY_BB_TYPE && map.bbType !== bbType) continue;
    const held = byPath.get(map.fieldPath);
    if (!held || held.bbType === ANY_BB_TYPE) byPath.set(map.fieldPath, map);
  }
  return [...byPath.values()];
}

const isMeasure = (key: string): key is MeasureKey => (MEASURES as readonly string[]).includes(key);

interface Raw extends RuleValue {
  /** The option key a choice answered with, for the map's own pair. */
  optionKey?: string;
}

function answerOf(product: BuildProduct, key: string): string | null {
  const v = product.facts[key as keyof StoredFacts]?.value;
  return v === undefined || v === null || v === "" ? null : String(v);
}

function context(product: BuildProduct): RuleContext {
  return {
    answer: (key) => answerOf(product, key),
    measure: (key) => product.measurements[key] ?? null,
    sizeLabel: product.sizeLabel,
  };
}

function fromAttribute(product: BuildProduct, key: string, labelOf: BuildInput["labelOf"]): Raw | null {
  if (isMeasure(key)) {
    const m = product.measurements[key];
    return m ? { value: String(m.value), unit: m.unit } : null;
  }
  const answer = answerOf(product, key);
  if (answer === null) return null;
  // A yes/no answer reads as Yes or No, the word Flipkart and Meesho take; a map pairs it by "true"/"false".
  if (typeof product.facts[key as keyof StoredFacts]?.value === "boolean") return { value: answer === "true" ? "Yes" : "No", optionKey: answer };
  return { value: labelOf(key, answer) ?? answer, optionKey: answer };
}

function fromCore(product: BuildProduct, key: string | null): Raw | null {
  switch (key) {
    case CORE_KEY.NAME: return product.name ? { value: product.name } : null;
    case CORE_KEY.SKU: return { value: product.sku };
    case CORE_KEY.DESCRIPTION: return product.description ? { value: product.description } : null;
    case CORE_KEY.BRAND: return product.brand ? { value: product.brand } : null;
    case CORE_KEY.BARCODE: return product.barcode ? { value: product.barcode } : null;
    case CORE_KEY.WEIGHT: return product.weightKg ? { value: String(product.weightKg), unit: "kg" } : null;
    case CORE_KEY.KIND: return product.kind ? { value: product.kind, optionKey: product.kind } : null;
    default: return null;
  }
}

function raw(map: FieldMapRow, input: BuildInput): Raw | null {
  const { product, labelOf } = input;
  switch (map.source) {
    case FIELD_SOURCE.ATTRIBUTE: return map.attributeKey ? fromAttribute(product, map.attributeKey, labelOf) : null;
    case FIELD_SOURCE.RULE: return map.ruleKey && isRuleKey(map.ruleKey) ? FIELD_RULES[map.ruleKey](context(product)) : null;
    case FIELD_SOURCE.CORE: return fromCore(product, map.coreKey);
    case FIELD_SOURCE.SHOP: return map.shopKey === SHOP_KEY.HSN && product.hsn ? { value: product.hsn } : null;
    // A fixed value is a default the product's own answer overrides (spec R4, D7).
    case FIELD_SOURCE.CONSTANT:
      return (map.attributeKey ? fromAttribute(product, map.attributeKey, labelOf) : null) ?? (map.constant ? { value: map.constant } : null);
    default: return null;
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The channel's word for a value (Q10): the map's pair, its allowed value of the same words, else as is. */
function paired(map: FieldMapRow, field: CatalogueFieldRow | undefined, r: Raw, measured = false): string | null {
  const pair = (key: string | undefined) => (key !== undefined && Object.hasOwn(map.values, key) ? map.values[key] : undefined);
  const allowed = Array.isArray(field?.allowedValues) ? (field.allowedValues as unknown[]).map(String) : [];
  const closedList = field?.kind === FIELD_KIND.CHOICE && allowed.length > 0;
  const explicit = pair(r.optionKey) ?? pair(r.value);
  // A pair to a word the channel's closed list no longer holds is a gap, not a refusal waiting to happen.
  if (explicit) return closedList && !allowed.includes(explicit) ? null : explicit;
  const match = allowed.find((a) => same(a, r.value)) ?? (measured ? nearestSize(allowed, r.value) : undefined);
  if (match) return match;
  // A closed list with no word for this answer is a gap, never a guess (Q6); free text goes as our words.
  return closedList ? null : r.value;
}

/**
 * The unit a measure goes in: the map's; else, when the channel lists its units and ours is not one, the
 * first of them ours converts to. A channel never receives our word where it has its own.
 */
function unitTargetOf(map: FieldMapRow, field: CatalogueFieldRow | undefined, unit: string): string | null | undefined {
  if (map.unitTarget) return map.unitTarget;
  const allowed = Array.isArray(field?.allowedUnits) ? (field.allowedUnits as unknown[]).map(String) : [];
  if (allowed.length === 0 || allowed.includes(unit)) return undefined;
  // null: no unit the channel lists fits ours, which is a gap.
  return allowed.find((a) => convert(1, unit, a) !== null) ?? null;
}

/**
 * A measurement against a list of sizes (Meesho's "Length Size" 10, 11, 12…): the nearest, as a size scale
 * reads (size-label.ts), but only inside the list and within half a step of a size. Outside it, or for a
 * count, it is a gap, never a guess (Q6, Q15).
 */
function nearestSize(allowed: readonly string[], value: string): string | undefined {
  const n = Number(value);
  const sizes = allowed.map(Number);
  if (!Number.isFinite(n) || sizes.length < 2 || sizes.some((x) => !Number.isFinite(x))) return undefined;
  const sorted = [...sizes].sort((a, b) => a - b);
  const step = Math.min(...sorted.slice(1).map((x, i) => x - sorted[i]).filter((d) => d > 0));
  const nearest = sorted.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best));
  if (!Number.isFinite(step) || Math.abs(nearest - n) > step / 2) return undefined;
  return allowed[sizes.indexOf(nearest)];
}

export function buildChannelListing(input: BuildInput): BuiltListing {
  const fieldBy = new Map(input.fields.map((f) => [f.key, f]));
  const required = (key: string) => fieldBy.get(key)?.requirement === FIELD_REQUIREMENT.REQUIRED;
  const label = (key: string) => fieldBy.get(key)?.label ?? key;
  const fields: BuiltField[] = [];
  const gaps: BuildGap[] = [];
  const gap = (key: string, reason: BuildGap["reason"], answer?: string) => {
    if (!gaps.some((g) => g.field === key)) gaps.push({ field: key, label: label(key), reason, ...(answer ? { answer } : {}) });
  };

  const keyOf = (path: string) => (fieldBy.has(path) ? path : fieldOf(path));
  for (const map of input.maps) {
    const key = keyOf(map.fieldPath);
    // A type that was read and has no such field takes nothing for it: Amazon refuses an attribute its schema lacks.
    if (input.fields.length > 0 && !fieldBy.has(key)) continue;
    // A map on a field the adapter would fill is deliberate (Google's age group, channel-catalogue Q8): it builds.
    const field = fieldBy.get(key);
    if (map.source === FIELD_SOURCE.DEVELOPER) {
      if (required(key)) gap(key, GAP_REASON.DEVELOPER);
      continue;
    }
    const r = raw(map, input);
    if (!r) {
      if (required(key)) gap(key, GAP_REASON.MISSING);
      continue;
    }
    let unit = r.unit;
    let value = r.value;
    const target = r.unit ? unitTargetOf(map, field, r.unit) : undefined;
    if (r.unit && target !== undefined) {
      const n = target === null ? null : convert(Number(r.value), r.unit, target);
      if (n === null) {
        if (required(key)) gap(key, GAP_REASON.MISSING);
        continue;
      }
      value = String(n);
      unit = target!;
    }
    // A measure onto a closed list (Meesho's sizes in inches) is a choice: paired, and sent without a unit.
    const closed = field?.kind === FIELD_KIND.CHOICE;
    const word = unit && !closed ? value : paired(map, field, { ...r, value }, unit !== undefined);
    if (word === null) {
      gap(key, GAP_REASON.NO_MATCH, value);
      continue;
    }
    fields.push({ path: map.fieldPath, value: word, ...(unit && !closed ? { unit } : {}) });
  }

  const covered = new Set(input.maps.map((m) => keyOf(m.fieldPath)));
  for (const f of input.fields) {
    if (f.requirement === FIELD_REQUIREMENT.REQUIRED && !f.adapterFills && !covered.has(f.key)) gap(f.key, GAP_REASON.UNMAPPED);
  }
  return { fields, gaps };
}
