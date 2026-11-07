/**
 * Turning a product into a new marketplace listing (marketplace-publish D7, D8). Pure: the variation
 * theme a family's page takes, and a SKU for a product with none.
 */

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
