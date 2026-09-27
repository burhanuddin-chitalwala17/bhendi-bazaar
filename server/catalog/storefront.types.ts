import { socialLinksFrom, type SocialLink } from "@server/catalog/social-networks";

/**
 * The brand page's payload (brand-page D1): the public face, and nothing that is not.
 *
 * Every field here is one an org would print on its shop sign. The private face — contact,
 * tax identifiers, commercial terms, a brand's manufacturer — has no key to arrive under,
 * and `tests/unit/storefront-public-dto.test.ts` holds the key set to an allowlist so one
 * cannot be added by accident.
 */
export interface BrandPageDto {
  id: string;
  handle: string;
  name: string;
  tagline: string | null;
  /** The cover image, at the top of the page and in the link preview. */
  heroUrl: string | null;
  /** The shop's mark. */
  logoUrl: string | null;
  /** A palette token name, never a colour literal (ADR-0022). */
  accent: string | null;
  /** As the org chooses to state it — one line of text, shown as typed. */
  location: string | null;
  /** The year the shop joined, from the day it did. */
  since: number;
  /** The introduction the storefront editor writes. */
  about: string | null;
  /** The longer story, when one is written. */
  story: string | null;
  deliveryPolicy: string | null;
  returnsPolicy: string | null;
  /** Names only, and only when the shop carries more than one (D8). */
  brands: string[] | null;
  social: SocialLink[] | null;
  /**
   * Derived proof, never typed (R4). Part (c) of PR 4 fills it through the reviews and
   * checkout services under the D3 floors; until then every page carries null.
   */
  proof: BrandProof | null;
}

export interface BrandProof {
  rating: { average: number; count: number } | null;
  ordersFulfilled: number | null;
}

/** What the profile repository's public read hands over. Structural, so the type owes it nothing. */
export interface PublicProfileRow {
  tagline: string | null;
  description: string | null;
  story: string | null;
  location: string | null;
  logoUrl: string | null;
  heroUrl: string | null;
  accent: string | null;
  deliveryPolicy: string | null;
  returnsPolicy: string | null;
  social: unknown;
  org: { id: string; handle: string; name: string; joinedAt: Date };
}

/** Blank is absent: a section fed whitespace would otherwise render an empty box (R2). */
const text = (value: string | null | undefined): string | null => value?.trim() || null;

/**
 * Takes `{ name }` and nothing wider, so a brand's manufacturer cannot ride along even if a
 * caller hands over the whole portal DTO (R10). One brand is not a range worth a section.
 */
export function brandNamesCarried(brands: ReadonlyArray<{ name: string }>): string[] | null {
  return brands.length > 1 ? brands.map((brand) => brand.name) : null;
}

export function toBrandPageDto(
  row: PublicProfileRow,
  brands: ReadonlyArray<{ name: string }>,
): BrandPageDto {
  return {
    id: row.org.id,
    handle: row.org.handle,
    name: row.org.name,
    tagline: text(row.tagline),
    heroUrl: row.heroUrl,
    logoUrl: row.logoUrl,
    accent: row.accent,
    location: text(row.location),
    since: row.org.joinedAt.getFullYear(),
    about: text(row.description),
    story: text(row.story),
    deliveryPolicy: text(row.deliveryPolicy),
    returnsPolicy: text(row.returnsPolicy),
    brands: brandNamesCarried(brands),
    social: socialLinksFrom(row.social),
    proof: null,
  };
}
