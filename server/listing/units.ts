/**
 * Converting a measure to the unit a channel asks (field-maps D4, spec A3). Each unit is a factor of its
 * family's base (grams, millimetres, millilitres); channels' own words sit beside ours.
 */

type Family = "weight" | "length" | "volume";

const UNITS: Record<string, { family: Family; factor: number }> = {
  mg: { family: "weight", factor: 0.001 }, milligrams: { family: "weight", factor: 0.001 },
  g: { family: "weight", factor: 1 }, gms: { family: "weight", factor: 1 }, grams: { family: "weight", factor: 1 },
  kg: { family: "weight", factor: 1000 }, kilograms: { family: "weight", factor: 1000 },
  oz: { family: "weight", factor: 28.349523125 }, ounces: { family: "weight", factor: 28.349523125 },
  lb: { family: "weight", factor: 453.59237 }, pounds: { family: "weight", factor: 453.59237 },
  mm: { family: "length", factor: 1 }, millimeters: { family: "length", factor: 1 },
  cm: { family: "length", factor: 10 }, centimeters: { family: "length", factor: 10 },
  m: { family: "length", factor: 1000 }, meters: { family: "length", factor: 1000 },
  in: { family: "length", factor: 25.4 }, inch: { family: "length", factor: 25.4 }, inches: { family: "length", factor: 25.4 },
  ml: { family: "volume", factor: 1 }, milliliters: { family: "volume", factor: 1 }, cubic_centimeters: { family: "volume", factor: 1 },
  cl: { family: "volume", factor: 10 }, centiliters: { family: "volume", factor: 10 },
  l: { family: "volume", factor: 1000 }, liters: { family: "volume", factor: 1000 },
};

const unitOf = (word: string) => UNITS[word.toLowerCase()];

/** Rounded to three decimals: a channel takes 0.45 kg, never 0.45000000000000001. */
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * A value in `from` as `to`, or null when either unit is unknown or the families differ: a wrong unit is
 * a gap for the shop to see, never a number quietly sent in the wrong scale.
 */
export function convert(value: number, from: string, to: string): number | null {
  const a = unitOf(from);
  const b = unitOf(to);
  if (!a || !b || a.family !== b.family) return null;
  return round((value * a.factor) / b.factor);
}

export const isKnownUnit = (word: string) => unitOf(word) !== undefined;
