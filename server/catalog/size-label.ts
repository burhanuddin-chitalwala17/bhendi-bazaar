import { UNIT, type MeasureKey, type Unit } from "./listing-facts";
import type { ProductTypeRecord } from "./product-type.types";

/**
 * The size label a product reads as, worked out from its measurements
 * ([product-types](../../docs/specs/listing-vocabulary/product-types/) D9).
 *
 * Derived and never stored: a label that is both computed and persisted is two facts that can
 * disagree, and the stale one wins because whatever reads the column never learns a fresher
 * answer existed. Measurements are what is stored, because a measurement derives a label and a
 * label derives no measurement — and because twelve of Meesho's nineteen nodes require a
 * measurement while none requires a label without one.
 *
 * Everything here reads the type's own row rather than a constant, so a scale is data: a ring's
 * diameter-to-size table is nine rows an admin can edit, and nearest-match is the generic code
 * below. That is what makes a type fully configurable rather than half.
 */

/** Measurements as the shop gave them, in the units the product type fixed. */
export type Measurements = Partial<Record<MeasureKey, number>>;

export const FREE_SIZE = "Free";

export interface SizeLabel {
  /** What a buyer or an adapter reads — `Free` for everything this store sells today. */
  label: string;
  /** The measurements the label was worked out from, so a screen can show its reasoning. */
  from: Measurements;
  /** The unit those measurements are in, fixed by the product type. */
  unit: Unit | null;
}

/** The nearest step of a declared scale. Nearest is honest here — a ring either fits or does not. */
function nearest(scale: readonly { value: number; label: string }[], value: number): string {
  let best = scale[0];
  for (const step of scale) {
    if (Math.abs(step.value - value) < Math.abs(best.value - value)) best = step;
  }
  return best.label;
}

function unitFor(type: ProductTypeRecord, measure: MeasureKey): Unit | null {
  return type.measures.find((m) => m.key === measure)?.unit ?? null;
}

/**
 * The label for a product of this type with these measurements.
 *
 * A type with a scale reads its first declared measurement against it — a ring's diameter
 * becoming a ring size. A type without one reads as free size, which is a permitted value on
 * every category this store sells into.
 *
 * Returns null when the type reads no label at all, so a caller shows nothing rather than an
 * empty one: a combo and an attar are not sized, they are measured.
 */
export function sizeLabelFor(
  type: ProductTypeRecord | null,
  measurements: Measurements,
): SizeLabel | null {
  if (!type || type.labelFrom.length === 0) return null;

  if (type.labelScale && type.labelScale.length > 0) {
    const key = type.labelFrom[0];
    const value = measurements[key];
    if (value === undefined) return null;
    return {
      label: nearest(type.labelScale, value),
      from: { [key]: value },
      unit: unitFor(type, key) ?? UNIT.MM,
    };
  }

  const from: Measurements = {};
  for (const key of type.labelFrom) {
    const value = measurements[key];
    if (value !== undefined) from[key] = value;
  }
  // No measurement means nothing to say. A product still saves (parent spec R5); it simply has
  // no size to show until somebody measures it.
  if (Object.keys(from).length === 0) return null;

  return { label: FREE_SIZE, from, unit: unitFor(type, type.labelFrom[0]) };
}

/** The measurements a type requires and the product has not given — what readiness reports. */
export function missingRequiredMeasurements(
  type: ProductTypeRecord | null,
  measurements: Measurements,
): MeasureKey[] {
  if (!type) return [];
  return type.measures.filter((m) => m.required && measurements[m.key] === undefined).map((m) => m.key);
}

/** How a measurement reads on screen: the number with the unit its type fixed. */
export function formatMeasurement(
  type: ProductTypeRecord | null,
  measure: MeasureKey,
  value: number | undefined,
): string | null {
  if (!type || value === undefined) return null;
  const unit = unitFor(type, measure);
  return unit ? `${value} ${unit}` : `${value}`;
}
