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
  const x = trigrams(a);
  const y = trigrams(b);
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
