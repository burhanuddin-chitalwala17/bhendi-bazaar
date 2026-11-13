import type { ResponsiveImageDto } from "@server/catalog/image-framing";
import type { ImageSlotValue } from "@server/catalog/image-framing";
import type { ShopReviewDto } from "@server/catalog/review.types";
import { socialLinksFrom, type SocialLink } from "@server/catalog/social-networks";
import {
  brandOwnerFrom,
  hiddenSectionsFrom,
  type BrandOwner,
  type HideableBrandPageSection,
} from "@server/catalog/brand-page-sections";
import type { ReturnsPreset } from "@server/catalog/shop-details.types";
import type { FontKey, HideableSection, PaletteKey, ThemeKey } from "@server/catalog/storefront-themes";
import type { OpeningHours } from "@server/catalog/storefront-hours";
import type { ClaimKey } from "@server/catalog/storefront-claims";

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
  /** "About your shop": `aboutOf` the profile (org-profile D4). */
  about: string | null;
  /** Always null since org-profile U2: the longer story is read through `about`. */
  story: null;
  /** The shop's returns promise and its note (org-profile D6). Null only when hidden. */
  returns: { preset: ReturnsPreset; note: string | null } | null;
  /** Names only, and only when the shop carries more than one (D8). */
  brands: string[] | null;
  social: SocialLink[] | null;
  /**
   * Derived proof, never typed (R4): rating and count from published reviews, orders from
   * paid orders, each under the floors in `brand-page-proof.ts` (D3). Null when nothing cleared one.
   */
  proof: BrandProof | null;
  /**
   * The shop's newest published reviews (R1, A3a): `ReviewDto` fields and the product each is
   * about, never a `userId`. Null under the rating's floor (D3).
   */
  buyersSay: ShopReviewDto[] | null;
  /** The person behind the shop, when one is named (R5). Null is "the story stands alone". */
  owner: BrandOwner | null;
  /**
   * What the shop has chosen not to show (R7). The content of a hidden section is left out of
   * this payload entirely, so a buyer's page cannot render it by mistake; the keys travel so
   * the shop's own panel can say "hidden" rather than "one fact away".
   */
  hiddenSections: HideableBrandPageSection[];
}

/**
 * A themed shop's landing page (storefront-themes D9): the brand page's public face and proof,
 * the published look, and what a landing page derives. Goods travel as ids, priced by the DAL.
 */
export interface StorefrontPageDto extends BrandPageDto {
  themeKey: ThemeKey;
  paletteKey: PaletteKey;
  /** The shop's heading face, or null for the theme's own (storefront-font D3). */
  fontKey: FontKey | null;
  /** By units sold in paid orders over 90 days, most first (Q34); the section needs four. */
  bestSellingIds: string[];
  /** Median whole days from paid to ready; null under the floor (Q38, Q39). */
  dispatchDays: number | null;
  /** The editor's content (D13). A hidden section's content is left out, as on the brand page. */
  heroLine: string | null;
  /** Up to three, the first being what a link preview shows (Q10). */
  heroPhotos: string[];
  /** The same photos with their phone version and framing, as `ResponsiveImage` draws them (image-slots D10). */
  heroImages: ResponsiveImageDto[];
  /** The categories the shop picked, in its order; empty means it picked none. */
  collections: StorefrontCollectionDto[];
  /** From the shop's fixed list, labels resolved (Q21); never a figure. */
  claims: StorefrontClaimDto[];
  openingHours: OpeningHours | null;
  themedHiddenSections: HideableSection[];
}

export interface StorefrontCollectionDto {
  slug: string;
  name: string;
  photoUrl: string | null;
  /** The shop's own photo with its framing (image-slots D10); absent when it falls back to the category's. */
  image?: ResponsiveImageDto | null;
}

export interface StorefrontClaimDto {
  label: string;
  detail: string | null;
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
  storyMergedAt: Date | null;
  location: string | null;
  logoUrl: string | null;
  heroUrl: string | null;
  accent: string | null;
  returnsPreset: ReturnsPreset;
  promiseNote: string | null;
  social: unknown;
  ownerName: string | null;
  ownerRole: string | null;
  ownerQuote: string | null;
  ownerPhotoUrl: string | null;
  hiddenSections: unknown;
  org: { id: string; handle: string; name: string; joinedAt: Date };
}

/** Blank is absent: a section fed whitespace would otherwise render an empty box (R2). */
const text = (value: string | null | undefined): string | null => value?.trim() || null;

/**
 * "About your shop" (org-profile D4, Q18): the introduction alone once the shop has saved the
 * joined box, or when there is no story; otherwise the two joined by a blank line. Buyers and
 * the box read this one function, so neither sees different words.
 */
export function aboutOf(row: {
  description: string | null;
  story: string | null;
  storyMergedAt: Date | null;
}): string | null {
  const intro = text(row.description);
  if (row.storyMergedAt) return intro;
  const story = text(row.story);
  if (!story) return intro;
  return intro ? `${intro}\n\n${story}` : story;
}

/**
 * Takes `{ name }` and nothing wider, so a brand's manufacturer cannot ride along even if a
 * caller hands over the whole portal DTO (R10). One brand is not a range worth a section.
 */
export function brandNamesCarried(brands: ReadonlyArray<{ name: string }>): string[] | null {
  return brands.length > 1 ? brands.map((brand) => brand.name) : null;
}

/** What the service derived through other surfaces (D2); the profile row knows none of it. */
export interface BrandPageDerived {
  proof: BrandProof | null;
  buyersSay: ShopReviewDto[] | null;
}

/**
 * Hiding is subtraction at the source, not a flag the page is trusted to honour (R7). A
 * section the shop has hidden leaves this payload with nothing in it, so there is no version
 * of the page — a cached one, a link preview, a future component — that can show it anyway.
 */
export function toBrandPageDto(
  row: PublicProfileRow,
  brands: ReadonlyArray<{ name: string }>,
  derived: BrandPageDerived,
): BrandPageDto {
  const hiddenSections = hiddenSectionsFrom(row.hiddenSections);
  const shown = <T>(section: HideableBrandPageSection, value: T): T | null =>
    hiddenSections.includes(section) ? null : value;

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
    // Hiding the story hides the person too: a name is part of the story, not beside it.
    about: shown("story", aboutOf(row)),
    story: null,
    returns: shown("policies", { preset: row.returnsPreset, note: text(row.promiseNote) }),
    brands: shown("brands", brandNamesCarried(brands)),
    social: shown("social", socialLinksFrom(row.social)),
    proof: derived.proof,
    buyersSay: derived.buyersSay,
    owner: shown("story", brandOwnerFrom(row)),
    hiddenSections,
  };
}

/**
 * The storefront editor's read (storefront-themes D13): the looks, the themed page's content, the
 * version a save compares-and-sets on, and what the section sheets offer.
 */
export interface StorefrontSettingsDto {
  handle: string;
  name: string;
  heroUrl: string | null;
  hiddenSections: unknown;
  /** ISO; sent back as `expectedUpdatedAt`. */
  updatedAt: string;
  heroLine: string | null;
  heroPhotos: string[];
  /** The same hero photos as picture sets with their framing, for the look sheet's field (image-slots D10). */
  heroImages: ImageSlotValue[];
  collections: Array<{ categoryId: string; photoUrl: string | null; image: ImageSlotValue | null }>;
  claims: Array<{ key: ClaimKey; detail: string | null }>;
  openingHours: OpeningHours | null;
  storefrontHiddenSections: HideableSection[];
  /** The shop's own claim list (Q21): its kind's, then the general ones. */
  claimOptions: Array<{ key: ClaimKey; label: string }>;
  /** The categories it sells in, the only ones a collection may be. */
  categoryOptions: Array<{ id: string; name: string }>;
}
