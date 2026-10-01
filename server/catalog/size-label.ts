import { MEASURE, UNIT, type MeasureKey, type Unit } from "./listing-facts";
import { PRODUCT_TYPE, declarationFor, type ProductTypeKey } from "./product-type";

/**
 * The size label a product reads as, worked out from its measurements
 * (listing-vocabulary/categories R5, D6/D7).
 *
 * Derived and never stored: a label that is both computed and persisted is two facts that can
 * disagree, and the stale one wins because whatever reads the column never learns a fresher
 * answer existed. Measurements are what is stored, because a measurement derives a label and a
 * label derives no measurement — and because twelve of Meesho's nineteen nodes require a
 * measurement while none requires a label without one.
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

/** Ring sizes are a scale of their own, and the one place a number beats a word. */
const RING_DIAMETER_TO_SIZE: readonly { mm: number; size: string }[] = [
  { mm: 14.0, size: "6" },
  { mm: 14.9, size: "8" },
  { mm: 15.7, size: "10" },
  { mm: 16.5, size: "12" },
  { mm: 17.3, size: "14" },
  { mm: 18.2, size: "16" },
  { mm: 19.0, size: "18" },
  { mm: 19.8, size: "20" },
  { mm: 20.6, size: "22" },
];

/** The nearest declared ring size; beyond the ends, the end. Nearest is honest here — a ring either fits or does not. */
function ringSizeFor(diameterMm: number): string {
  let nearest = RING_DIAMETER_TO_SIZE[0];
  for (const step of RING_DIAMETER_TO_SIZE) {
    if (Math.abs(step.mm - diameterMm) < Math.abs(nearest.mm - diameterMm)) nearest = step;
  }
  return nearest.size;
}

function unitFor(type: ProductTypeKey, measure: MeasureKey): Unit | null {
  return declarationFor(type).measures.find((m) => m.key === measure)?.unit ?? null;
}

/**
 * The label for a product of this type with these measurements.
 *
 * Everything this store sells is free size, so the answer is `Free` wherever a garment-style
 * label is wanted — which is a permitted value on every category it sells into. Jewellery is the
 * exception, because a ring's size is a real scale rather than a word.
 *
 * Returns null when the type has no notion of size at all, so a caller shows nothing rather than
 * an empty label: a combo and an attar are not sized, they are measured.
 */
export function sizeLabelFor(
  type: ProductTypeKey | null,
  measurements: Measurements,
): SizeLabel | null {
  if (!type) return null;

  if (type === PRODUCT_TYPE.JEWELLERY) {
    const diameter = measurements[MEASURE.DIAMETER];
    if (diameter === undefined) return null;
    return {
      label: ringSizeFor(diameter),
      from: { [MEASURE.DIAMETER]: diameter },
      unit: unitFor(type, MEASURE.DIAMETER) ?? UNIT.MM,
    };
  }

  const sized = SIZED_BY[type];
  if (!sized) return null;

  const from: Measurements = {};
  for (const key of sized) {
    const value = measurements[key];
    if (value !== undefined) from[key] = value;
  }
  // No measurement means nothing to say. A product still saves (parent spec R5); it simply has
  // no size to show until somebody measures it.
  if (Object.keys(from).length === 0) return null;

  return { label: FREE_SIZE, from, unit: unitFor(type, sized[0]) };
}

/**
 * Which measurements a type's label is read from. A type absent here has no notion of size —
 * fragrance is measured by capacity and a combo is not sized at all.
 */
const SIZED_BY: Partial<Record<ProductTypeKey, readonly MeasureKey[]>> = {
  [PRODUCT_TYPE.ISLAMIC_WEAR]: [MEASURE.LENGTH, MEASURE.BUST, MEASURE.WAIST, MEASURE.HIP, MEASURE.SHOULDER],
  [PRODUCT_TYPE.TROUSERS]: [MEASURE.LENGTH, MEASURE.WAIST],
  [PRODUCT_TYPE.PRAYER_MAT]: [MEASURE.LENGTH, MEASURE.WIDTH],
  [PRODUCT_TYPE.BAG]: [MEASURE.LENGTH, MEASURE.WIDTH, MEASURE.HEIGHT],
  [PRODUCT_TYPE.TRAVEL_POUCH]: [MEASURE.LENGTH, MEASURE.WIDTH, MEASURE.HEIGHT],
  [PRODUCT_TYPE.SOCKS]: [MEASURE.LENGTH],
};

/** The measurements a type requires and the product has not given — what readiness reports (parent spec R5). */
export function missingRequiredMeasurements(
  type: ProductTypeKey | null,
  measurements: Measurements,
): MeasureKey[] {
  if (!type) return [];
  return declarationFor(type)
    .measures.filter((m) => m.required && measurements[m.key] === undefined)
    .map((m) => m.key);
}

/** How a measurement reads on screen: the number with the unit its type fixed. */
export function formatMeasurement(
  type: ProductTypeKey | null,
  measure: MeasureKey,
  value: number | undefined,
): string | null {
  if (!type || value === undefined) return null;
  const unit = unitFor(type, measure);
  return unit ? `${value} ${unit}` : `${value}`;
}
