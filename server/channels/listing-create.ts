import { FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";

/**
 * Turning a product into a new marketplace listing (marketplace-publish D7, D8). Pure: the mapping
 * read forwards, and the variation theme a family's page takes.
 */

interface AttributeRow {
  theirCategory: string;
  fact: string;
  theirAttribute: string;
}
interface ValueRow {
  list: string;
  valueKey: string;
  theirValue: string;
}

const factValue = (facts: unknown, key: string): string | null => {
  const entry = facts && typeof facts === "object" ? (facts as Record<string, unknown>)[key] : null;
  const value = entry && typeof entry === "object" ? (entry as { value?: unknown }).value : null;
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : null;
};

/**
 * Our facts in a marketplace's attribute names and values (D8): channel-registry's mapping read the
 * other way. A listed answer goes as their word for it; one with no word recorded is left out for
 * the marketplace's check to name, never guessed (parent Q42). Free text goes as typed.
 */
export function forwardAttributes(theirCategory: string, attributes: readonly AttributeRow[], values: readonly ValueRow[], facts: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of attributes) {
    if (row.theirCategory !== theirCategory) continue;
    const answer = factValue(facts, row.fact);
    if (answer === null) continue;
    const list = FACT_DECLARATIONS[row.fact as FactKey]?.list;
    if (!list) {
      out[row.theirAttribute] = answer;
      continue;
    }
    const theirs = values.find((v) => v.list === list && v.valueKey === answer);
    if (theirs) out[row.theirAttribute] = theirs.theirValue;
  }
  return out;
}

/** The lists a product's facts answer from, for reading only the value rows needed. */
export function listsOf(facts: unknown): string[] {
  const keys = facts && typeof facts === "object" ? Object.keys(facts as object) : [];
  return [...new Set(keys.map((k) => FACT_DECLARATIONS[k as FactKey]?.list).filter((l): l is string => !!l))];
}

const AXIS_WORDS: Record<string, readonly string[]> = {
  colour: ["COLOR"],
  color: ["COLOR"],
  size: ["SIZE"],
  plating: ["METAL", "MATERIAL", "COLOR"],
  capacity: ["SIZE", "VOLUME", "CAPACITY"],
  volume: ["SIZE", "VOLUME"],
  pack: ["NUMBER_OF_ITEMS", "ITEM_PACKAGE_QUANTITY", "SIZE"],
};

/**
 * The theme a family's page varies by (D7): the one Amazon allows whose name holds the family's axis,
 * the single-axis theme first; null when none fits, so the family is refused rather than guessed.
 */
export function pickTheme(axis: readonly string[], themes: readonly string[]): string | null {
  const words = axis.flatMap((a) => AXIS_WORDS[a.toLowerCase()] ?? [a.toUpperCase()]);
  const fits = themes.filter((t) => words.some((w) => t.toUpperCase().includes(w)));
  if (fits.length === 0) return null;
  return [...fits].sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length)[0];
}

/** A SKU for a product with none (Q7): its own id's tail, which no other product shares. */
export const skuFor = (product: { id: string; sku: string | null }) => product.sku ?? `BB-${product.id.slice(-10).toUpperCase()}`;
