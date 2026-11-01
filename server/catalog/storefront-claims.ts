/**
 * The claims a shop may state in "Why buy from us" (storefront-themes Q21, D9): keys from a fixed
 * list for what it sells, each with an optional one-line detail, styled apart from derived facts.
 * A fixed list keeps a claim checkable; free text became slogans.
 *
 * "What it sells" is the shop's main product type (Q44): product types ship as reference data
 * with stable keys, while browsing categories are reorganised for merchandising.
 */

export const CLAIM = {
  CHECKED: "checked",
  GIFT_WRAP: "giftWrap",
  FAMILY_RUN: "familyRun",
  OWN_WORKSHOP: "ownWorkshop",
  HALLMARKED: "hallmarked",
  CERTIFIED_STONES: "certifiedStones",
  LIFETIME_POLISH: "lifetimePolish",
  HAND_STITCHED: "handStitched",
  FREE_ALTERATIONS: "freeAlterations",
  PURE_FABRIC: "pureFabric",
  ALCOHOL_FREE: "alcoholFree",
  BLENDED_IN_HOUSE: "blendedInHouse",
  HANDWOVEN: "handwoven",
  GENUINE_LEATHER: "genuineLeather",
} as const;
export type ClaimKey = (typeof CLAIM)[keyof typeof CLAIM];
export const CLAIM_KEYS = Object.values(CLAIM) as [ClaimKey, ...ClaimKey[]];

export const CLAIM_LABEL: Record<ClaimKey, string> = {
  [CLAIM.CHECKED]: "Every order checked before it ships",
  [CLAIM.GIFT_WRAP]: "Gift wrapping on request",
  [CLAIM.FAMILY_RUN]: "Family-run shop",
  [CLAIM.OWN_WORKSHOP]: "Made in our own workshop",
  [CLAIM.HALLMARKED]: "BIS hallmarked",
  [CLAIM.CERTIFIED_STONES]: "Certified stones",
  [CLAIM.LIFETIME_POLISH]: "Free polishing for life",
  [CLAIM.HAND_STITCHED]: "Hand-stitched",
  [CLAIM.FREE_ALTERATIONS]: "Free alterations",
  [CLAIM.PURE_FABRIC]: "Pure fabric, no blends",
  [CLAIM.ALCOHOL_FREE]: "Alcohol-free",
  [CLAIM.BLENDED_IN_HOUSE]: "Blended in-house",
  [CLAIM.HANDWOVEN]: "Handwoven",
  [CLAIM.GENUINE_LEATHER]: "Genuine leather",
};

/** Q21: up to three. */
export const MAX_CLAIMS = 3;
export const CLAIM_DETAIL_MAX = 80;

/** Any shop may say these. */
const GENERAL: readonly ClaimKey[] = [CLAIM.CHECKED, CLAIM.GIFT_WRAP, CLAIM.FAMILY_RUN, CLAIM.OWN_WORKSHOP];

/** A product type's word for a shop ("Suggested for Jewellery") and the claims only it may make. */
export const SHOP_KINDS: Record<string, { label: string; claims: readonly ClaimKey[] }> = {
  jewellery: { label: "Jewellery", claims: [CLAIM.HALLMARKED, CLAIM.CERTIFIED_STONES, CLAIM.LIFETIME_POLISH] },
  "islamic-wear": { label: "Islamic wear", claims: [CLAIM.HAND_STITCHED, CLAIM.FREE_ALTERATIONS, CLAIM.PURE_FABRIC] },
  trousers: { label: "Trousers", claims: [CLAIM.HAND_STITCHED, CLAIM.FREE_ALTERATIONS, CLAIM.PURE_FABRIC] },
  fragrance: { label: "Attar and bakhoor", claims: [CLAIM.ALCOHOL_FREE, CLAIM.BLENDED_IN_HOUSE] },
  "prayer-mat": { label: "Prayer mats", claims: [CLAIM.HANDWOVEN] },
  bag: { label: "Bags", claims: [CLAIM.GENUINE_LEATHER] },
  "travel-pouch": { label: "Travel pouches", claims: [CLAIM.GENUINE_LEATHER] },
  socks: { label: "Socks", claims: [] },
  combo: { label: "Gift sets", claims: [] },
};

/** The list a shop picks from: its kind's own claims, then the general ones. */
export function claimsFor(productType: string | null): ClaimKey[] {
  const own = productType ? (SHOP_KINDS[productType]?.claims ?? []) : [];
  return [...own, ...GENERAL];
}

export interface StoredClaim {
  key: ClaimKey;
  detail: string | null;
}

/**
 * Stored claims parsed on read (D1's rule for keys): an unknown key, or one no longer on the
 * shop's list because it now sells something else, is dropped rather than shown unchecked.
 */
export function readClaims(value: unknown, productType: string | null): StoredClaim[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(claimsFor(productType));
  const out: StoredClaim[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { key, detail } = entry as { key?: unknown; detail?: unknown };
    if (typeof key !== "string" || !allowed.has(key) || out.some((c) => c.key === key)) continue;
    out.push({ key: key as ClaimKey, detail: typeof detail === "string" && detail.trim() ? detail.trim() : null });
  }
  return out.slice(0, MAX_CLAIMS);
}
