/**
 * Which listings link to which products by SKU (channel-import D7). Pure: the import service hands
 * it the rows and the shop's SKUs, and writes what it answers.
 */

/** Equal after trimming spaces and ignoring case, and nothing looser (Q3). */
export const skuKey = (sku: string): string => sku.trim().toLowerCase();

export interface MatchCandidate {
  id: string;
  sku: string | null;
}

export interface MatchableListing {
  skuKey: string;
  productId: string | null;
  unlinkedAt: Date | null;
}

/**
 * The product a listing should link to now, or null. A listing already linked, or unlinked by the
 * owner (Q5), is left as it is. Two products answering one key is impossible here because a SKU is
 * unique per shop; the first wins rather than throwing, should the data ever disagree.
 */
export function productForListing(listing: MatchableListing, bySkuKey: Map<string, string>): string | null {
  if (listing.productId || listing.unlinkedAt) return null;
  return bySkuKey.get(listing.skuKey) ?? null;
}

export function indexBySkuKey(products: readonly MatchCandidate[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const product of products) {
    if (!product.sku) continue;
    const key = skuKey(product.sku);
    if (key && !index.has(key)) index.set(key, product.id);
  }
  return index;
}

/** Below this, two names are not offered as the same item (product-merge D3). */
export const SIMILAR_NAME_MIN = 0.4;

const trigrams = (text: string): Set<string> => {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const out = new Set<string>();
  // Padded per word, as pg_trgm does, so short words still count and word order matters less.
  for (const word of words) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
};

/** The Dice coefficient of two names' trigram sets: 1 is the same name, 0 nothing shared. */
export function nameSimilarity(a: string, b: string): number {
  return dice(trigrams(a), trigrams(b));
}

function dice(x: Set<string>, y: Set<string>): number {
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const gram of x) if (y.has(gram)) shared++;
  return (2 * shared) / (x.size + y.size);
}

/** The closest candidates to `name`, at or above the threshold, best first. */
export function mostSimilar<T extends { name: string }>(
  name: string,
  candidates: readonly T[],
  limit = 3,
  min = SIMILAR_NAME_MIN,
): T[] {
  return candidates
    .map((candidate) => ({ candidate, score: nameSimilarity(name, candidate.name) }))
    .filter((entry) => entry.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** Two titles this close may be one item in different colours or sizes (family-merge D6). */
export const SAME_ITEM_MIN = 0.6;
/** Listings one suggestion may group, as a family page takes (family-merge Q19). */
const GROUP_MAX = 30;

/**
 * A SKU without its last part: "HJB-CHF-PCH" → "hjb-chf". Only a SKU of three parts or more has
 * one: "HJB-001" and "HJB-002" are a brand and a number, not one item, and would chain the
 * shop's catalogue together.
 */
export function skuStem(sku: string): string | null {
  const parts = sku.trim().toLowerCase().split(/[-_ /.]+/).filter(Boolean);
  if (parts.length < 3) return null;
  return parts.slice(0, -1).join("-");
}

/**
 * Listings that look like one item, for a marketplace that does not group them (family-merge D6,
 * Q5): the same SKU stem, or titles this close, joined transitively. Only ever a suggestion.
 */
export function suggestGroups<T extends { id: string; sku: string; title: string | null }>(rows: readonly T[]): T[][] {
  // Each title's trigrams and SKU's stem once, not once per pair: hundreds of listings stay cheap.
  const grams = rows.map((r) => (r.title ? trigrams(r.title) : null));
  const stems = rows.map((r) => skuStem(r.sku));
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const sameStem = stems[i] !== null && stems[i] === stems[j];
      const x = grams[i];
      const y = grams[j];
      if (sameStem || (x && y && dice(x, y) >= SAME_ITEM_MIN)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, T[]>();
  rows.forEach((row, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), row]));
  return [...groups.values()].filter((g) => g.length >= 2 && g.length <= GROUP_MAX);
}
