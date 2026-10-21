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
